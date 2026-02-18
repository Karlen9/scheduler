'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Booking, TimeSlot } from '@/lib/types';
import { BottomSheet } from '@/components/BottomSheet';
import { CalendarView } from '@/components/CalendarView';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { PrimaryButton } from '@/components/PrimaryButton';
import { api } from '@/lib/api';
import { useWorkingHours, useDaysOff } from '@/hooks/queries';

interface RescheduleSheetProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function RescheduleSheet({ booking, isOpen, onClose, onSuccess }: RescheduleSheetProps) {
  const t = useTranslations('RescheduleSheet');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');
  const { data: workingHoursData } = useWorkingHours();
  const { data: daysOffData } = useDaysOff();

  const nonWorkingDays = useMemo(() => {
    const workingSet = new Set(workingHoursData.map((wh) => wh.dayOfWeek));
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (!workingSet.has(i)) result.push(i);
    }
    return result;
  }, [workingHoursData]);

  const daysOff = useMemo(() => daysOffData.map((d) => d.date), [daysOffData]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duration = booking?.durationMinutes || booking?.sessionType?.durationMinutes || 60;

  const fetchSlots = useCallback(
    async (date: Date) => {
      setIsLoadingSlots(true);
      setSelectedTime(null);
      setError(null);
      try {
        const dateStr = formatDateISO(date);
        const slots = await api.getAvailableSlots(dateStr, duration);
        setTimeSlots(slots);
      } catch {
        setTimeSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [duration],
  );

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    fetchSlots(date);
  };

  const handleSubmit = async () => {
    if (!booking || !selectedDate || !selectedTime) return;
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

  const handleClose = () => {
    setSelectedDate(null);
    setSelectedTime(null);
    setTimeSlots([]);
    setError(null);
    onClose();
  };

  const hasAvailableSlots = timeSlots.some((s) => s.available);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={t('title')}
      className="max-h-[85vh] overflow-y-auto"
    >
      <div className="space-y-4">
        <CalendarView
          selectedDate={selectedDate}
          onSelectDate={handleDateSelect}
          nonWorkingDays={nonWorkingDays}
          daysOff={daysOff}
        />

        {isLoadingSlots && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="bg-card animate-pulse rounded-lg py-3 text-sm text-transparent"
              >
                00:00
              </div>
            ))}
          </div>
        )}

        {selectedDate && !isLoadingSlots && timeSlots.length > 0 && (
          <>
            <h4 className="text-muted-foreground text-sm font-medium">{t('selectTime')}</h4>
            {hasAvailableSlots ? (
              <TimeSlotGrid slots={timeSlots} selected={selectedTime} onSelect={setSelectedTime} />
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">{t('noSlots')}</p>
            )}
          </>
        )}

        {error && <p className="text-destructive text-center text-sm">{error}</p>}

        {selectedTime && (
          <PrimaryButton onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? tc('saving') : t('submitButton')}
          </PrimaryButton>
        )}
      </div>
    </BottomSheet>
  );
}
