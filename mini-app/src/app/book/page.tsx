"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { SessionTypeSelector } from "@/components/SessionTypeSelector";
import { CalendarView } from "@/components/CalendarView";
import { TimeSlotGrid } from "@/components/TimeSlotGrid";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SuccessModal } from "@/components/SuccessModal";
import { EmptyState } from "@/components/EmptyState";
import { BottomSafeArea } from "@/components/BottomSafeArea";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/telegram";
import { TimeSlot, SessionType } from "@/lib/types";

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedDate = searchParams.get("date");
  const rescheduleBookingId = searchParams.get("reschedule");
  const preSelectedSessionType = searchParams.get("sessionType");
  const isReschedule = !!rescheduleBookingId;

  const [step, setStep] = useState<"date" | "time">(
    preSelectedDate ? "time" : "date",
  );
  const [sessionTypes, setSessionTypes] = useState<
    { id: string; label: string }[]
  >([]);
  const [sessionType, setSessionType] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    preSelectedDate ? new Date(preSelectedDate) : null,
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);
  const [nonWorkingDays, setNonWorkingDays] = useState<number[]>([]);
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch working hours, days off, and session types on mount
  useEffect(() => {
    async function loadScheduleData() {
      try {
        const [workingHours, daysOffData, services] = await Promise.all([
          api.getWorkingHours(),
          api.getDaysOff(),
          api.getSessionTypes(),
        ]);

        // Compute non-working days: days 0-6 not present in working hours
        const workingDaySet = new Set(workingHours.map((wh) => wh.dayOfWeek));
        const nonWorking: number[] = [];
        for (let i = 0; i < 7; i++) {
          if (!workingDaySet.has(i)) {
            nonWorking.push(i);
          }
        }
        setNonWorkingDays(nonWorking);

        // Extract date strings from days off
        setDaysOff(daysOffData.map((d) => d.date));

        // Map session types to selector format
        const types = services.map((s: SessionType) => ({
          id: s.type,
          label: s.name,
        }));
        setSessionTypes(types);
        if (preSelectedSessionType && types.some((t: { id: string }) => t.id === preSelectedSessionType)) {
          setSessionType(preSelectedSessionType);
        } else if (types.length > 0) {
          setSessionType(types[0].id);
        }
      } catch (err) {
        console.error("Failed to load schedule data:", err);
      }
    }
    loadScheduleData();
  }, []);

  const formatDateISO = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const fetchSlots = useCallback(
    async (date: Date, type: string) => {
      setIsLoading(true);
      setSelectedTime(null);
      setError(null);
      try {
        const dateStr = formatDateISO(date);
        const slots = await api.getAvailableSlots(dateStr, type);
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

  // Re-fetch slots when session type changes and a date is already selected
  useEffect(() => {
    if (selectedDate && sessionType) {
      fetchSlots(selectedDate, sessionType);
    }
  }, [sessionType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load slots for pre-selected date
  useEffect(() => {
    if (preSelectedDate && selectedDate && sessionType) {
      fetchSlots(selectedDate, sessionType);
    }
  }, [preSelectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (sessionType) {
      fetchSlots(date, sessionType);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !sessionType) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (rescheduleBookingId) {
        await api.cancelBooking(rescheduleBookingId, "Перенос записи");
      }
      const dateStr = formatDateISO(selectedDate);
      const name = getUserName();
      await api.createBooking(sessionType, dateStr, selectedTime, name);
      setShowSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось создать запись";
      setError(message);
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
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      <TopBar title={isReschedule ? "Перенос записи" : "Запись на тренировку"} showBack />

      <div className="flex-1 p-4 space-y-4 pb-24">
        {sessionTypes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Тип тренировки
            </h3>
            <SessionTypeSelector
              options={sessionTypes}
              selected={sessionType}
              onChange={setSessionType}
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

        {error && (
          <div className="p-3 bg-destructive/10 rounded-lg text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {step === "time" && !noSlotsAvailable && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border"
          style={{ maxWidth: "430px", margin: "0 auto", width: "100%" }}
        >
          <PrimaryButton
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isSubmitting ? "Отправка..." : isReschedule ? "Подтвердить перенос" : "Подтвердить запись"}
          </PrimaryButton>
        </div>
      )}

      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title={isReschedule ? "Запись перенесена" : "Запись отправлена"}
        description={`Вы записаны на ${selectedDate ? formatDate(selectedDate) : ""} в ${selectedTime}. Ожидайте подтверждения.`}
      />

      <BottomSafeArea />
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
