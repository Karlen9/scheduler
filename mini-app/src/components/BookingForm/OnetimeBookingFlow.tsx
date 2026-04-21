'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef } from 'react';

import { CalendarView } from '@/components/CalendarView';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { formatDateISO } from '@/lib/helpers';

import { BookingSummary } from './BookingSummary';
import { PinnedBottomButton } from './PinnedBottomButton';
import { ServiceCard } from './ServiceCard';
import { TimeSlotLegend } from './TimeSlotLegend';
import { useOnetimeBooking } from './useOnetimeBooking';

import type { TOnetimeBookingFlowProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the onetime booking flow UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function OnetimeBookingFlow({
  services,
  daysOff,
  bookedDates,
  showRecurring,
  selectedClient,
  hasClientSelector,
  nonWorkingDays,
  onCreateBooking,
  successRedirect,
  initialDate,
  initialService,
  initialTime,
  initialComment,
}: TOnetimeBookingFlowProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');

  const bookedDatesSet = useMemo(() => new Set(bookedDates ?? []), [bookedDates]);
  const dateStageRef = useRef<HTMLDivElement | null>(null);
  const timeStageRef = useRef<HTMLDivElement | null>(null);
  const completionStageRef = useRef<HTMLDivElement | null>(null);

  const scrollToStage = useCallback((stageRef: { current: HTMLDivElement | null }): void => {
    window.setTimeout(() => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      stage.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }, 80);
  }, []);

  const {
    mode,
    setMode,
    selectedService,
    selectedDate,
    selectedTime,
    selectedDates,
    activeDateISO,
    timeAssignments,
    timeSlots,
    isLoadingSlots,
    message,
    setMessage,
    multiActiveTime,
    onetimeButtonText,
    onetimeButtonDisabled,
    handleServiceSelect,
    handleEditService,
    handleSingleDateSelect,
    handleSingleTimeSelect,
    handleMultiDateToggle,
    handleChipTap,
    handleMultiTimeSelect,
    handleOnetimeSubmit,
  } = useOnetimeBooking({
    services,
    bookedDates,
    selectedClient,
    hasClientSelector,
    onCreateBooking,
    successRedirect,
    initialDate,
    initialService,
    initialTime,
    initialComment,
  });

  const handleServiceSelectAndScroll = (service: (typeof services)[number]): void => {
    handleServiceSelect(service);
    scrollToStage(dateStageRef);
  };

  const handleSingleDateSelectAndScroll = (date: Date): void => {
    handleSingleDateSelect(date);
    scrollToStage(timeStageRef);
  };

  const handleSingleTimeSelectAndScroll = (time: string): void => {
    handleSingleTimeSelect(time);
    scrollToStage(completionStageRef);
  };

  const handleMultiDateToggleAndScroll = (date: Date): void => {
    const iso = formatDateISO(date);
    const isSelectingDate = !selectedDates.some((selected) => formatDateISO(selected) === iso);
    handleMultiDateToggle(date);
    if (isSelectingDate) {
      scrollToStage(timeStageRef);
    }
  };

  const handleMultiTimeSelectAndScroll = (time: string): void => {
    if (!activeDateISO) {
      handleMultiTimeSelect(time);
      return;
    }

    const nextAssignments = { ...timeAssignments, [activeDateISO]: time };
    const allAssigned = selectedDates.every((date) => nextAssignments[formatDateISO(date)]);
    handleMultiTimeSelect(time);
    if (allAssigned) {
      scrollToStage(completionStageRef);
    }
  };

  return (
    <>
      {/***************************************************************************************************
       * Service Selection.
       ***************************************************************************************************/}
      {!selectedService ? (
        <div className={'space-y-3'}>
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              selected={false}
              onSelect={() => handleServiceSelectAndScroll(service)}
              minLabel={tc('min')}
            />
          ))}
          {services.length > 1 && (
            <p className={'text-muted-foreground px-1 text-xs'}>{t('selectServiceHint')}</p>
          )}
        </div>
      ) : (
        <>
          <ServiceCard
            service={selectedService}
            selected
            onSelect={() => {}}
            onEdit={handleEditService}
            minLabel={tc('min')}
          />

          {/***************************************************************************************************
           * Single/Multi mode toggle.
           ***************************************************************************************************/}
          <div ref={dateStageRef} className={'scroll-mt-4'}>
            <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>
              {mode === 'single' ? t('selectDay') : t('selectDays')}
            </h3>
            <div className={'bg-card mb-4 flex rounded-xl p-1'}>
              <button
                onClick={() => setMode('single')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'single' ? 'bg-brand text-white' : 'text-muted-foreground'
                }`}
              >
                {showRecurring ? t('singleSelect') : t('singleSelectShort')}
              </button>
              <button
                onClick={() => setMode('multi')}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'multi' ? 'bg-brand text-white' : 'text-muted-foreground'
                }`}
              >
                {showRecurring ? t('multiSelect') : t('multiSelectShort')}
              </button>
            </div>

            {mode === 'single' ? (
              <CalendarView
                selectedDate={selectedDate}
                onSelectDate={handleSingleDateSelectAndScroll}
                nonWorkingDays={nonWorkingDays}
                daysOff={daysOff}
                bookedDates={bookedDates}
              />
            ) : (
              <CalendarView
                selectedDate={null}
                selectedDates={selectedDates}
                onSelectDate={handleMultiDateToggleAndScroll}
                nonWorkingDays={nonWorkingDays}
                daysOff={daysOff}
                bookedDates={bookedDates}
              />
            )}

            {((mode === 'single' &&
              selectedDate &&
              bookedDatesSet.has(formatDateISO(selectedDate))) ||
              (mode === 'multi' &&
                selectedDates.some((d) => bookedDatesSet.has(formatDateISO(d))))) && (
              <p className={'text-warning mt-2 text-xs'}>{t('bookedDateWarning')}</p>
            )}
          </div>

          {/***************************************************************************************************
           * Time Slots Loading.
           ***************************************************************************************************/}
          {isLoadingSlots && timeSlots.length === 0 && (
            <div ref={timeStageRef} className={'scroll-mt-4'}>
              <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>
                {t('selectTime')}
              </h3>
              <div className={'grid grid-cols-4 gap-2'}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={
                      'bg-card animate-pulse rounded-lg py-3 text-center text-sm text-transparent'
                    }
                  >
                    {'00:00'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/***************************************************************************************************
           * Single Mode: Time Slots.
           ***************************************************************************************************/}
          {mode === 'single' && selectedDate && timeSlots.length > 0 && (
            <div
              ref={timeStageRef}
              className={`transition-opacity duration-200 ${isLoadingSlots ? 'pointer-events-none opacity-40' : ''}`}
            >
              <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>
                {t('selectTime')}
              </h3>
              <TimeSlotLegend
                availableLabel={t('available')}
                occupiedLabel={t('occupied')}
                mineLabel={!hasClientSelector ? t('myBooking') : undefined}
              />
              <TimeSlotGrid
                slots={timeSlots}
                selected={selectedTime}
                onSelect={handleSingleTimeSelectAndScroll}
              />
            </div>
          )}

          {/***************************************************************************************************
           * Single Mode: Summary.
           ***************************************************************************************************/}
          {mode === 'single' && selectedDate && selectedService && (
            <BookingSummary
              date={selectedDate}
              service={selectedService}
              time={selectedTime}
              minLabel={tc('min')}
            />
          )}

          {/***************************************************************************************************
           * Multi Mode: Time Slots.
           ***************************************************************************************************/}
          {mode === 'multi' &&
            selectedDates.length > 0 &&
            activeDateISO &&
            timeSlots.length > 0 && (
              <div
                ref={timeStageRef}
                className={`transition-opacity duration-200 ${isLoadingSlots ? 'pointer-events-none opacity-40' : ''}`}
              >
                <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>
                  {t('selectTime')}
                </h3>
                <TimeSlotLegend
                  availableLabel={t('available')}
                  occupiedLabel={t('occupied')}
                  mineLabel={!hasClientSelector ? t('myBooking') : undefined}
                />
                <TimeSlotGrid
                  slots={timeSlots}
                  selected={multiActiveTime}
                  onSelect={handleMultiTimeSelectAndScroll}
                />
              </div>
            )}

          {/***************************************************************************************************
           * Comment.
           ***************************************************************************************************/}
          {((mode === 'single' && selectedTime) ||
            (mode === 'multi' &&
              selectedDates.length > 0 &&
              selectedDates.every((d) => timeAssignments[formatDateISO(d)]))) && (
            <div ref={completionStageRef} className={'scroll-mt-4'}>
              <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>{t('comment')}</h3>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('commentPlaceholder')}
                rows={2}
                maxLength={500}
                className={
                  'bg-card text-foreground focus:ring-brand w-full resize-none rounded-lg px-4 py-3 text-sm outline-none focus:ring-2'
                }
              />
            </div>
          )}
        </>
      )}

      <PinnedBottomButton
        activeDateISO={activeDateISO}
        selectedDates={selectedDates}
        handleChipTap={handleChipTap}
        onetimeButtonDisabled={onetimeButtonDisabled}
        onetimeButtonText={onetimeButtonText}
        selectedService={selectedService}
        handleOnetimeSubmit={handleOnetimeSubmit}
        mode={mode}
        timeAssignments={timeAssignments}
      />
    </>
  );
}
