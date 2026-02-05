"use client";

import { useState, useEffect, Suspense } from "react";
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

const sessionTypes = [
  { id: "personal", label: "Персональная" },
  { id: "online", label: "Онлайн" },
  { id: "stretching", label: "Растяжка" },
];

const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 9; hour <= 20; hour++) {
    const time = `${hour.toString().padStart(2, "0")}:00`;
    // Simulate some unavailable slots
    const available = Math.random() > 0.3;
    slots.push({ time, available });
  }
  return slots;
};

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedDate = searchParams.get("date");

  const [step, setStep] = useState<"date" | "time">(
    preSelectedDate ? "time" : "date",
  );
  const [sessionType, setSessionType] = useState("personal");
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    preSelectedDate ? new Date(preSelectedDate) : null,
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState(generateTimeSlots());
  const [showSuccess, setShowSuccess] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsLoading(true);
    // Simulate loading time slots
    setTimeout(() => {
      const slots = generateTimeSlots();
      setTimeSlots(slots);
      setIsLoading(false);

      // Check if there are any available slots
      const hasAvailableSlots = slots.some((slot) => slot.available);
      setNoSlotsAvailable(!hasAvailableSlots);

      if (hasAvailableSlots) {
        setStep("time");
      }
    }, 800);
  };

  const handleConfirm = () => {
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push("/bookings");
  };

  const canConfirm = selectedDate && selectedTime;

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
      <TopBar title="Запись на тренировку" showBack />

      <div className="flex-1 p-4 space-y-4 pb-24">
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

        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {step === "date" ? "Выберите дату" : "Выбрана дата"}
          </h3>
          <CalendarView
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
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
      </div>

      {step === "time" && !noSlotsAvailable && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border"
          style={{ maxWidth: "430px", margin: "0 auto", width: "100%" }}
        >
          <PrimaryButton onClick={handleConfirm} disabled={!canConfirm}>
            Подтвердить запись
          </PrimaryButton>
        </div>
      )}

      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title="Запись подтверждена"
        description={`Вы записаны на ${selectedDate ? formatDate(selectedDate) : ""} в ${selectedTime}`}
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
