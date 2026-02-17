"use client";

import { useState, useCallback, useMemo } from "react";
import { Booking, TimeSlot } from "@/lib/types";
import { BottomSheet } from "@/components/BottomSheet";
import { CalendarView } from "@/components/CalendarView";
import { TimeSlotGrid } from "@/components/TimeSlotGrid";
import { PrimaryButton } from "@/components/PrimaryButton";
import { api } from "@/lib/api";
import { useWorkingHours, useDaysOff } from "@/hooks/queries";

interface RescheduleSheetProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function RescheduleSheet({ booking, isOpen, onClose, onSuccess }: RescheduleSheetProps) {
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
      setError(err instanceof Error ? err.message : "Не удалось перенести запись");
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
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Перенос записи" className="max-h-[85vh] overflow-y-auto">
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
              <div key={i} className="py-3 rounded-lg bg-card animate-pulse text-sm text-transparent">
                00:00
              </div>
            ))}
          </div>
        )}

        {selectedDate && !isLoadingSlots && timeSlots.length > 0 && (
          <>
            <h4 className="text-sm font-medium text-muted-foreground">Выберите время</h4>
            {hasAvailableSlots ? (
              <TimeSlotGrid slots={timeSlots} selected={selectedTime} onSelect={setSelectedTime} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет доступных слотов на эту дату
              </p>
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {selectedTime && (
          <PrimaryButton onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Сохранение..." : "Перенести"}
          </PrimaryButton>
        )}
      </div>
    </BottomSheet>
  );
}
