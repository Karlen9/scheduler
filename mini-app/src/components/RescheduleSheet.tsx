'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { CalendarView } from '@/components/CalendarView';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { useAdminScheduleContext } from '@/hooks/queries';
import { api } from '@/lib/api';
import { formatDateISO, getNonWorkingDays } from '@/lib/helpers';

import type { TRescheduleSheetProps, TTimeSlot } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the reschedule sheet UI and related interactions.
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
export function RescheduleSheet({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: TRescheduleSheetProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('RescheduleSheet');
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the te value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  const { data: scheduleContext } = useAdminScheduleContext();
  /***************************************************************************************************
   * Defines the working hours data value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const workingHoursData = scheduleContext?.workingHours ?? [];
  /***************************************************************************************************
   * Defines the days off data value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOffData = scheduleContext?.daysOff ?? [];

  /***************************************************************************************************
   * Defines the non working days value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const nonWorkingDays = useMemo(() => getNonWorkingDays(workingHoursData), [workingHoursData]);

  /***************************************************************************************************
   * Defines the days off value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOff = useMemo(() => daysOffData.map((d) => d.date), [daysOffData]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TTimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /***************************************************************************************************
   * Defines the slots request id ref value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const slotsRequestIdRef = useRef(0);

  /***************************************************************************************************
   * Defines the duration value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const duration = booking?.durationMinutes || booking?.sessionType?.durationMinutes || 60;

  /***************************************************************************************************
   * Defines the fetch slots value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const fetchSlots = useCallback(
    async (date: Date) => {
      /***************************************************************************************************
       * Defines the request id value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const requestId = slotsRequestIdRef.current + 1;
      slotsRequestIdRef.current = requestId;
      setIsLoadingSlots(true);
      setSelectedTime(null);
      setError(null);
      try {
        /***************************************************************************************************
         * Defines the date str value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const dateStr = formatDateISO(date);
        /***************************************************************************************************
         * Defines the slots value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const slots = await api.getAvailableSlots(dateStr, duration);
        if (requestId !== slotsRequestIdRef.current) {
          return;
        }
        setTimeSlots(slots);
      } catch {
        if (requestId !== slotsRequestIdRef.current) {
          return;
        }
        setTimeSlots([]);
      } finally {
        if (requestId === slotsRequestIdRef.current) {
          setIsLoadingSlots(false);
        }
      }
    },
    [duration],
  );

  /***************************************************************************************************
   * Handles date select.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDateSelect = (date: Date): void => {
    setSelectedDate(date);
    fetchSlots(date);
  };

  /***************************************************************************************************
   * Handles submit.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleSubmit = async (): Promise<void> => {
    if (!booking || !selectedDate || !selectedTime) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await api.admin.rescheduleBooking(booking.id, {
        date: formatDateISO(selectedDate),
        time: selectedTime,
      });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : te('bookingRescheduleFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /***************************************************************************************************
   * Handles close.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleClose = (): void => {
    slotsRequestIdRef.current += 1;
    setSelectedDate(null);
    setSelectedTime(null);
    setTimeSlots([]);
    setError(null);
    onClose();
  };

  /***************************************************************************************************
   * Defines the has available slots value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasAvailableSlots = timeSlots.some((s) => s.available);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={t('title')}
      className={'max-h-[85vh] overflow-y-auto'}
    >
      <div className={'space-y-4'}>
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={handleDateSelect}
          nonWorkingDays={nonWorkingDays}
          daysOff={daysOff}
        />

        {isLoadingSlots && (
          <div className={'grid grid-cols-3 gap-2'}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={'bg-card animate-pulse rounded-lg py-3 text-sm text-transparent'}
              >
                {'00:00'}
              </div>
            ))}
          </div>
        )}

        {selectedDate && !isLoadingSlots && timeSlots.length > 0 && (
          <>
            <h4 className={'text-muted-foreground text-sm font-medium'}>{t('selectTime')}</h4>
            {hasAvailableSlots ? (
              <TimeSlotGrid slots={timeSlots} selected={selectedTime} onSelect={setSelectedTime} />
            ) : (
              <p className={'text-muted-foreground py-4 text-center text-sm'}>{t('noSlots')}</p>
            )}
          </>
        )}

        {error && <p className={'text-destructive text-center text-sm'}>{error}</p>}

        {selectedTime && (
          <PrimaryButton onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? tc('saving') : t('submitButton')}
          </PrimaryButton>
        )}
      </div>
    </BottomSheet>
  );
}
