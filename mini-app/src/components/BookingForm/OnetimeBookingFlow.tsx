'use client';

import { useTranslations } from 'next-intl';

import { CalendarView } from '@/components/CalendarView';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { formatDateISO } from '@/lib/helpers';

import { BookingSummary } from './BookingSummary';
import { PinnedBottomButton } from './PinnedBottomButton';
import { ServiceCard } from './ServiceCard';
import { TimeSlotLegend } from './TimeSlotLegend';
import { useOnetimeBooking } from './useOnetimeBooking';

import type { TClientInfo, TCreateBookingParams, TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

export type TOnetimeBookingFlowProps = {
  services: TSessionType[];
  daysOff: string[];
  bookedDates?: string[];
  showRecurring: boolean;
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  nonWorkingDays: number[];
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
};

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
}: TOnetimeBookingFlowProps): ReactNode {
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');

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
    selectedClient,
    hasClientSelector,
    onCreateBooking,
    successRedirect,
  });

  return (
    <>
      {/* Service Selection */}
      {!selectedService ? (
        <div className={'space-y-3'}>
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              selected={false}
              onSelect={() => handleServiceSelect(service)}
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

          {/* Single/Multi mode toggle */}
          <div>
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
                onSelectDate={handleSingleDateSelect}
                nonWorkingDays={nonWorkingDays}
                daysOff={daysOff}
                bookedDates={bookedDates}
              />
            ) : (
              <CalendarView
                selectedDate={null}
                selectedDates={selectedDates}
                onSelectDate={handleMultiDateToggle}
                nonWorkingDays={nonWorkingDays}
                daysOff={daysOff}
                bookedDates={bookedDates}
              />
            )}
          </div>

          {/* Time Slots Loading */}
          {isLoadingSlots && timeSlots.length === 0 && (
            <div>
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

          {/* Single Mode: Time Slots */}
          {mode === 'single' && selectedDate && timeSlots.length > 0 && (
            <div
              className={`transition-opacity duration-200 ${isLoadingSlots ? 'pointer-events-none opacity-40' : ''}`}
            >
              <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>
                {t('selectTime')}
              </h3>
              <TimeSlotLegend availableLabel={t('available')} occupiedLabel={t('occupied')} />
              <TimeSlotGrid
                slots={timeSlots}
                selected={selectedTime}
                onSelect={handleSingleTimeSelect}
              />
            </div>
          )}

          {/* Single Mode: Summary */}
          {mode === 'single' && selectedDate && selectedService && (
            <BookingSummary
              date={selectedDate}
              service={selectedService}
              time={selectedTime}
              minLabel={tc('min')}
            />
          )}

          {/* Multi Mode: Time Slots */}
          {mode === 'multi' &&
            selectedDates.length > 0 &&
            activeDateISO &&
            timeSlots.length > 0 && (
              <div
                className={`transition-opacity duration-200 ${isLoadingSlots ? 'pointer-events-none opacity-40' : ''}`}
              >
                <h3 className={'text-muted-foreground mb-2 text-sm font-medium'}>
                  {t('selectTime')}
                </h3>
                <TimeSlotLegend availableLabel={t('available')} occupiedLabel={t('occupied')} />
                <TimeSlotGrid
                  slots={timeSlots}
                  selected={multiActiveTime}
                  onSelect={handleMultiTimeSelect}
                />
              </div>
            )}

          {/* Comment */}
          {((mode === 'single' && selectedTime) ||
            (mode === 'multi' &&
              selectedDates.length > 0 &&
              selectedDates.every((d) => timeAssignments[formatDateISO(d)]))) && (
            <div>
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
