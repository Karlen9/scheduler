"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ServiceSelector } from "@/components/ServiceSelector";
import { CalendarSkeleton } from "@/components/LoadingSkeleton";
import { CalendarView } from "@/components/CalendarView";
import { TimeSlotGrid } from "@/components/TimeSlotGrid";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SuccessModal } from "@/components/SuccessModal";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { getUserName } from "@/lib/telegram";
import { SessionType, TimeSlot } from "@/lib/types";
import { useWorkingHours, useDaysOff, useSessionTypes, useProfile } from "@/hooks/queries";
import { invalidateBookings } from "@/hooks/mutations";

function BookingPageContent() {
  const router = useRouter();

  const { data: workingHoursData, isLoading: whLoading } = useWorkingHours();
  const { data: daysOffData, isLoading: doLoading } = useDaysOff();
  const { data: services, isLoading: svcLoading } = useSessionTypes();
  const { data: profile, isLoading: profLoading } = useProfile();
  const isInitialLoading = whLoading || doLoading || svcLoading || profLoading;

  const [step, setStep] = useState<"date" | "time">("date");
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);
  const [message, setMessage] = useState("");

  const nonWorkingDays = (() => {
    const workingDaySet = new Set(workingHoursData.map((wh) => wh.dayOfWeek));
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (!workingDaySet.has(i)) result.push(i);
    }
    return result;
  })();

  const daysOff = daysOffData.map((d) => d.date);

  // Auto-select first service when only one exists
  useEffect(() => {
    if (services.length === 1 && !selectedService) {
      setSelectedService(services[0]);
    }
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleServiceChange = (service: SessionType) => {
    setSelectedService(service);
    if (selectedDate) {
      fetchSlots(selectedDate, service.durationMinutes);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !selectedService) return;

    setIsSubmitting(true);
    try {
      const dateStr = formatDateISO(selectedDate);
      const name = getUserName();
      await api.createBooking(selectedService.durationMinutes, dateStr, selectedTime, name, message || undefined);
      invalidateBookings();
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

  const canConfirm = selectedDate && selectedTime && selectedService && !isSubmitting;

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
            {/* Duration selector */}
            <div>
              <div className="h-4 bg-card rounded w-28 mb-2" />
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-card rounded-lg" />
                <div className="flex-1 h-10 bg-card rounded-lg" />
                <div className="flex-1 h-10 bg-card rounded-lg" />
              </div>
            </div>
            {/* Calendar */}
            <div>
              <div className="h-4 bg-card rounded w-24 mb-2" />
              <CalendarSkeleton />
            </div>
          </div>
        ) : (
        <>
        {services.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Услуга
            </h3>
            <ServiceSelector
              services={services}
              selectedId={selectedService?.id ?? ""}
              onChange={handleServiceChange}
            />
            {services.length > 1 && !selectedService && (
              <p className="text-xs text-muted-foreground mt-2">
                Выберите услугу для продолжения
              </p>
            )}
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
        description={`Вы записаны на ${selectedDate ? formatDate(selectedDate) : ""} в ${selectedTime}${selectedService ? ` — ${selectedService.name}` : ""}. Ожидайте подтверждения.`}
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
