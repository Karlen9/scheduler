"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DurationSelector } from "@/components/DurationSelector";
import { CalendarView } from "@/components/CalendarView";
import { TimeSlotGrid } from "@/components/TimeSlotGrid";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SuccessModal } from "@/components/SuccessModal";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/telegram";
import { TimeSlot } from "@/lib/types";
import { formatDuration } from "@/components/DurationSelector";

function BookingPageContent() {
  const router = useRouter();

  const [step, setStep] = useState<"date" | "time">("date");
  const [durations, setDurations] = useState<number[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);
  const [nonWorkingDays, setNonWorkingDays] = useState<number[]>([]);
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    async function loadScheduleData() {
      try {
        const [workingHours, daysOffData, availableDurations, profile] = await Promise.all([
          api.getWorkingHours(),
          api.getDaysOff(),
          api.getDurations(),
          api.getProfile().catch(() => null),
        ]);

        const workingDaySet = new Set(workingHours.map((wh) => wh.dayOfWeek));
        const nonWorking: number[] = [];
        for (let i = 0; i < 7; i++) {
          if (!workingDaySet.has(i)) {
            nonWorking.push(i);
          }
        }
        setNonWorkingDays(nonWorking);
        setDaysOff(daysOffData.map((d) => d.date));
        setDurations(availableDurations);

        const preferred = profile?.preferredDuration || 0;
        if (preferred && availableDurations.includes(preferred)) {
          setSelectedDuration(preferred);
        } else if (availableDurations.length > 0) {
          setSelectedDuration(availableDurations[0]);
        }
      } catch (err) {
        console.error("Failed to load schedule data:", err);
      } finally {
        setIsInitialLoading(false);
      }
    }
    loadScheduleData();
  }, []);

  const formatDateISO = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const fetchSlots = useCallback(
    async (date: Date, duration: number) => {
      if (!duration) return;
      setIsLoading(true);
      setSelectedTime(null);
      try {
        const dateStr = formatDateISO(date);
        const slots = await api.getAvailableSlots(dateStr, duration);
        setTimeSlots(slots);

        const hasAvailableSlots = slots.some((slot) => slot.available);
        setNoSlotsAvailable(!hasAvailableSlots);

        if (hasAvailableSlots) {
          setStep("time");
        }
      } catch (err) {
        console.error("Failed to load time slots:", err);
        setTimeSlots([]);
        setNoSlotsAvailable(true);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedDate && selectedDuration) {
      fetchSlots(selectedDate, selectedDuration);
    }
  }, [selectedDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (selectedDuration) {
      fetchSlots(date, selectedDuration);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !selectedDuration) return;

    setIsSubmitting(true);
    try {
      const dateStr = formatDateISO(selectedDate);
      const name = getUserName();
      await api.createBooking(selectedDuration, dateStr, selectedTime, name, message || undefined);
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось создать запись";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push("/bookings");
  };

  const canConfirm = selectedDate && selectedTime && !isSubmitting;

  const formatDate = (date: Date) => {
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  return (
    <div className="flex flex-col">
      <div className="flex-1 p-4 space-y-4 pb-24">
        {isInitialLoading ? (
          <div className="space-y-4 animate-pulse">
            <div>
              <div className="h-4 bg-card rounded w-28 mb-2" />
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-card rounded-lg" />
                <div className="flex-1 h-10 bg-card rounded-lg" />
                <div className="flex-1 h-10 bg-card rounded-lg" />
              </div>
            </div>
            <div>
              <div className="h-4 bg-card rounded w-24 mb-2" />
              <div className="bg-card rounded-xl p-4">
                <div className="h-8 bg-border rounded w-40 mx-auto mb-4" />
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-border rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
        <>
        {durations.length > 1 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Длительность
            </h3>
            <DurationSelector
              durations={durations}
              selected={selectedDuration}
              onChange={setSelectedDuration}
            />
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {step === "date" ? "Выберите дату" : "Выбрана дата"}
          </h3>
          <CalendarView
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            nonWorkingDays={nonWorkingDays}
            daysOff={daysOff}
          />
          {selectedDate && step === "date" && !isLoading && (
            <div className="mt-3 p-3 bg-card rounded-lg text-center">
              <p className="text-sm text-foreground">
                Выбрана дата:{" "}
                <span className="font-medium">{formatDate(selectedDate)}</span>
              </p>
            </div>
          )}
        </div>

        {isLoading && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Выберите время
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="py-3 rounded-lg bg-card animate-pulse text-sm text-transparent"
                >
                  00:00
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "time" && selectedDate && !isLoading && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Выберите время
            </h3>
            {noSlotsAvailable ? (
              <EmptyState
                icon={<AlertCircle className="w-16 h-16" />}
                title="Нет доступных слотов"
                description="К сожалению, на выбранную дату нет свободного времени. Попробуйте выбрать другой день."
              />
            ) : (
              <TimeSlotGrid
                slots={timeSlots}
                selected={selectedTime}
                onSelect={setSelectedTime}
              />
            )}
          </div>
        )}

        {step === "time" && selectedTime && !noSlotsAvailable && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Комментарий
            </h3>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Пожелания или комментарий (необязательно)"
              rows={2}
              maxLength={500}
              className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand resize-none text-sm"
            />
          </div>
        )}
        {step === "time" && !noSlotsAvailable && (
          <PrimaryButton
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isSubmitting ? "Отправка..." : "Подтвердить запись"}
          </PrimaryButton>
        )}
        </>
        )}
      </div>

      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title="Запись отправлена"
        description={`Вы записаны на ${selectedDate ? formatDate(selectedDate) : ""} в ${selectedTime}${selectedDuration ? ` (${formatDuration(selectedDuration)})` : ""}. Ожидайте подтверждения.`}
      />
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          Загрузка...
        </div>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
