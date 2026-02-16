"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Clock } from "lucide-react";
import { toast } from "sonner";
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

const MONTH_SHORT = ["Янв", "Фев", "Мар", "Апр", "Мая", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MONTHS_FULL = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatPrice(price: number, currency: string): string {
  const formatted = new Intl.NumberFormat("ru-RU").format(price);
  return `${formatted} ${currency}`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ──── Service Card ────

function ServiceCard({
  service,
  selected,
  onSelect,
  onEdit,
}: {
  service: SessionType;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  return (
    <button
      onClick={selected ? onEdit : onSelect}
      className={`w-full bg-card rounded-xl p-4 text-left transition-all ${
        selected ? "ring-2 ring-brand" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-snug">{service.name}</p>
        {selected && (
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-brand text-white shrink-0">
            <Pencil className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2.5">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {service.durationMinutes} мин
        </span>
        <span className="text-xs text-muted-foreground">
          {formatPrice(service.price, service.currency)}
        </span>
      </div>
    </button>
  );
}

// ──── Time Slot Legend ────

function TimeSlotLegend() {
  return (
    <div className="flex items-center gap-4 mb-3">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-brand" />
        <span className="text-xs text-muted-foreground">Свободно</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-error" />
        <span className="text-xs text-muted-foreground">Занято</span>
      </div>
    </div>
  );
}

// ──── Date Chip (multi-mode) ────

function DateChip({
  date,
  time,
  endTime,
  active,
  onClick,
}: {
  date: Date;
  time?: string;
  endTime?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-xl min-w-[56px] transition-all ${
        active
          ? "border border-border outline-2 outline-brand bg-card"
          : "border border-border bg-card"
      }`}
    >
      <span className="text-lg font-semibold text-foreground">{date.getDate()}</span>
      <span className="text-[10px] text-muted-foreground">{MONTH_SHORT[date.getMonth()]}</span>
      {time ? (
        <>
          <span className="text-[10px] text-foreground mt-1">{time}</span>
          {endTime && <span className="text-[10px] text-muted-foreground">{endTime}</span>}
        </>
      ) : (
        <span className="text-sm text-muted-foreground mt-1">?</span>
      )}
    </button>
  );
}

// ──── Booking Summary Card (single mode) ────

function BookingSummary({
  date,
  service,
  time,
}: {
  date: Date;
  service: SessionType;
  time: string | null;
}) {
  const endTime = time ? addMinutesToTime(time, service.durationMinutes) : null;
  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-4">
      <div className="flex flex-col items-center justify-center w-14">
        <span className="text-2xl font-bold text-foreground leading-none">{date.getDate()}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{MONTH_SHORT[date.getMonth()]}</span>
      </div>
      <div className="flex-1 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {date.getDate()} {MONTHS_FULL[date.getMonth()]}
        </p>
        <p className="text-sm text-foreground truncate">{service.name}</p>
        {time && (
          <p className="text-xs text-muted-foreground">
            {time} &ndash; {endTime} &middot; {service.durationMinutes} мин
          </p>
        )}
      </div>
    </div>
  );
}

// ──── Main Page Content ────

function BookingPageContent() {
  const router = useRouter();

  const { data: workingHoursData, isLoading: whLoading } = useWorkingHours();
  const { data: daysOffData, isLoading: doLoading } = useDaysOff();
  const { data: services, isLoading: svcLoading } = useSessionTypes();
  const { data: profile, isLoading: profLoading } = useProfile();
  const isInitialLoading = whLoading || doLoading || svcLoading || profLoading;

  // Mode
  const [mode, setMode] = useState<"single" | "multi">("single");

  // Service
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);

  // Single mode
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Multi mode
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [activeDateISO, setActiveDateISO] = useState<string | null>(null);
  const [timeAssignments, setTimeAssignments] = useState<Record<string, string>>({});

  // Shared
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
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

  // Reset selections when mode changes
  useEffect(() => {
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedDates([]);
    setActiveDateISO(null);
    setTimeAssignments({});
    setTimeSlots([]);
    setNoSlotsAvailable(false);
    setMessage("");
  }, [mode]);

  const fetchSlots = useCallback(
    async (date: Date, duration: number) => {
      if (!duration) return;
      setIsLoadingSlots(true);
      try {
        const dateStr = formatDateISO(date);
        const slots = await api.getAvailableSlots(dateStr, duration);
        setTimeSlots(slots);
        const hasAvailable = slots.some((s) => s.available);
        setNoSlotsAvailable(!hasAvailable);
      } catch (err) {
        console.error("Failed to load time slots:", err);
        setTimeSlots([]);
        setNoSlotsAvailable(true);
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [],
  );

  // ──── Service handlers ────

  const handleServiceSelect = (service: SessionType) => {
    const changed = selectedService?.id !== service.id;
    setSelectedService(service);
    if (changed) {
      // Reset downstream selections
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedDates([]);
      setActiveDateISO(null);
      setTimeAssignments({});
      setTimeSlots([]);
      setNoSlotsAvailable(false);
    }
  };

  const handleEditService = () => {
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedDates([]);
    setActiveDateISO(null);
    setTimeAssignments({});
    setTimeSlots([]);
    setNoSlotsAvailable(false);
  };

  // ──── Single mode handlers ────

  const handleSingleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    if (selectedService) {
      fetchSlots(date, selectedService.durationMinutes);
    }
  };

  const handleSingleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  // ──── Multi mode handlers ────

  const handleMultiDateToggle = (date: Date) => {
    const iso = formatDateISO(date);
    const exists = selectedDates.some((d) => formatDateISO(d) === iso);

    if (exists) {
      // Remove date
      const newDates = selectedDates.filter((d) => formatDateISO(d) !== iso);
      setSelectedDates(newDates);
      setTimeAssignments((prev) => {
        const next = { ...prev };
        delete next[iso];
        return next;
      });
      // If removed date was active, pick first remaining
      if (activeDateISO === iso) {
        if (newDates.length > 0) {
          const firstISO = formatDateISO(newDates[0]);
          setActiveDateISO(firstISO);
          if (selectedService) fetchSlots(newDates[0], selectedService.durationMinutes);
        } else {
          setActiveDateISO(null);
          setTimeSlots([]);
          setNoSlotsAvailable(false);
        }
      }
    } else {
      // Limit to 6 dates
      if (selectedDates.length >= 6) return;
      // Add date and make it active
      const newDates = [...selectedDates, date].sort((a, b) => a.getTime() - b.getTime());
      setSelectedDates(newDates);
      setActiveDateISO(iso);
      if (selectedService) fetchSlots(date, selectedService.durationMinutes);
    }
  };

  const handleChipTap = (date: Date) => {
    const iso = formatDateISO(date);
    setActiveDateISO(iso);
    if (selectedService) fetchSlots(date, selectedService.durationMinutes);
  };

  const handleMultiTimeSelect = (time: string) => {
    if (!activeDateISO || !selectedService) return;
    const newAssignments = { ...timeAssignments, [activeDateISO]: time };
    setTimeAssignments(newAssignments);

    // Auto-advance to next unassigned date
    const currentIndex = selectedDates.findIndex((d) => formatDateISO(d) === activeDateISO);
    for (let i = currentIndex + 1; i < selectedDates.length; i++) {
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
    // Check dates before current too
    for (let i = 0; i < currentIndex; i++) {
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
  };

  // ──── Submit handlers ────

  const handleSingleSubmit = async () => {
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

  const handleMultiSubmit = async () => {
    if (!selectedService) return;
    setIsSubmitting(true);
    const name = getUserName();
    try {
      for (const date of selectedDates) {
        const iso = formatDateISO(date);
        const time = timeAssignments[iso];
        if (!time) continue;
        await api.createBooking(selectedService.durationMinutes, iso, time, name, message || undefined);
      }
      invalidateBookings();
      setShowSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось создать запись";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (mode === "single") handleSingleSubmit();
    else handleMultiSubmit();
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push("/bookings");
  };

  // ──── Button state ────

  const getButtonState = () => {
    if (!selectedService) return { text: "Выберите услугу", disabled: true };
    if (mode === "single") {
      if (!selectedDate) return { text: "Выберите дату", disabled: true };
      if (!selectedTime) return { text: "Выберите время", disabled: true };
      return { text: isSubmitting ? "Отправка..." : "Записаться", disabled: isSubmitting };
    } else {
      if (selectedDates.length === 0) return { text: "Выберите дни", disabled: true };
      const allAssigned = selectedDates.every((d) => timeAssignments[formatDateISO(d)]);
      if (!allAssigned) return { text: "Выберите время", disabled: true };
      return { text: isSubmitting ? "Отправка..." : "Записаться", disabled: isSubmitting };
    }
  };

  const { text: buttonText, disabled: buttonDisabled } = getButtonState();

  // ──── Multi mode: active time for the selected chip ────
  const multiActiveTime = activeDateISO ? timeAssignments[activeDateISO] ?? null : null;

  // ──── Success message ────
  const getSuccessDescription = () => {
    if (mode === "single" && selectedDate && selectedTime && selectedService) {
      return `Вы записаны на ${selectedDate.getDate()} ${MONTHS_FULL[selectedDate.getMonth()]} в ${selectedTime} - ${selectedService.name}. Ожидайте подтверждения.`;
    }
    if (mode === "multi") {
      return `Создано записей: ${selectedDates.length}. Ожидайте подтверждения.`;
    }
    return "Ожидайте подтверждения.";
  };

  // ──── Render ────

  return (
    <div className="flex flex-col">
      <div className="flex-1 p-4 space-y-4 pb-24">
        <h2 className="text-lg font-semibold px-1">Онлайн запись</h2>

        {isInitialLoading ? (
          <div className="space-y-4 animate-pulse">
            <div>
              <div className="h-4 bg-card rounded w-28 mb-2" />
              <div className="space-y-3">
                <div className="h-20 bg-card rounded-xl" />
                <div className="h-20 bg-card rounded-xl" />
              </div>
            </div>
            <div>
              <div className="h-4 bg-card rounded w-24 mb-2" />
              <CalendarSkeleton />
            </div>
          </div>
        ) : (
        <>
          {/* ── Service Selection ── */}
          {!selectedService ? (
            <div className="space-y-3">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={false}
                  onSelect={() => handleServiceSelect(service)}
                />
              ))}
              {services.length > 1 && (
                <p className="text-xs text-muted-foreground px-1">
                  Выберите услугу для продолжения
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Selected service card */}
              <ServiceCard
                service={selectedService}
                selected
                onSelect={() => {}}
                onEdit={handleEditService}
              />

              {/* ── Mode Toggle ── */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {mode === "single" ? "Выберите день" : "Выберите дни"}
                </h3>
                <div className="flex bg-card rounded-xl p-1 mb-4">
                  <button
                    onClick={() => setMode("single")}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                      mode === "single" ? "bg-brand text-white" : "text-muted-foreground"
                    }`}
                  >
                    Одиночный выбор
                  </button>
                  <button
                    onClick={() => setMode("multi")}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                      mode === "multi" ? "bg-brand text-white" : "text-muted-foreground"
                    }`}
                  >
                    Множественный выбор
                  </button>
                </div>

                {/* ── Calendar ── */}
                {mode === "single" ? (
                  <CalendarView
                    selectedDate={selectedDate}
                    onSelectDate={handleSingleDateSelect}
                    nonWorkingDays={nonWorkingDays}
                    daysOff={daysOff}
                  />
                ) : (
                  <CalendarView
                    selectedDate={null}
                    selectedDates={selectedDates}
                    onSelectDate={handleMultiDateToggle}
                    nonWorkingDays={nonWorkingDays}
                    daysOff={daysOff}
                  />
                )}
              </div>

              {/* ── Time Slots Loading (initial only, no existing slots) ── */}
              {isLoadingSlots && timeSlots.length === 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Выберите время
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="py-3 rounded-lg bg-card animate-pulse text-sm text-transparent text-center"
                      >
                        00:00
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Single Mode: Time Slots ── */}
              {mode === "single" && selectedDate && timeSlots.length > 0 && (
                <div className={`transition-opacity duration-200 ${isLoadingSlots ? "opacity-40 pointer-events-none" : ""}`}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Выберите время
                  </h3>
                  <TimeSlotLegend />
                  {noSlotsAvailable ? (
                    <EmptyState
                      icon={<AlertCircle className="w-16 h-16" />}
                      title="Нет доступных слотов"
                      description="На выбранную дату нет свободного времени. Попробуйте другой день."
                    />
                  ) : (
                    <TimeSlotGrid
                      slots={timeSlots}
                      selected={selectedTime}
                      onSelect={handleSingleTimeSelect}
                    />
                  )}
                </div>
              )}

              {/* ── Single Mode: Summary Card ── */}
              {mode === "single" && selectedDate && selectedService && !noSlotsAvailable && (
                <BookingSummary
                  date={selectedDate}
                  service={selectedService}
                  time={selectedTime}
                />
              )}

              {/* ── Multi Mode: Date Chips + Time Slots ── */}
              {mode === "multi" && selectedDates.length > 0 && (
                <>
                  {/* Time slots for active chip */}
                  {activeDateISO && timeSlots.length > 0 && (
                    <div className={`transition-opacity duration-200 ${isLoadingSlots ? "opacity-40 pointer-events-none" : ""}`}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Выберите время
                      </h3>
                      <TimeSlotLegend />
                      {noSlotsAvailable ? (
                        <EmptyState
                          icon={<AlertCircle className="w-16 h-16" />}
                          title="Нет доступных слотов"
                          description="На выбранную дату нет свободного времени. Попробуйте другой день."
                        />
                      ) : (
                        <TimeSlotGrid
                          slots={timeSlots}
                          selected={multiActiveTime}
                          onSelect={handleMultiTimeSelect}
                        />
                      )}
                    </div>
                  )}

                  {/* Date chips strip */}
                  <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1">
                    {selectedDates.map((date) => {
                      const iso = formatDateISO(date);
                      const time = timeAssignments[iso];
                      const endTime = time && selectedService
                        ? addMinutesToTime(time, selectedService.durationMinutes)
                        : undefined;
                      return (
                        <DateChip
                          key={iso}
                          date={date}
                          time={time}
                          endTime={endTime}
                          active={activeDateISO === iso}
                          onClick={() => handleChipTap(date)}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Comment ── */}
              {((mode === "single" && selectedTime && !noSlotsAvailable) ||
                (mode === "multi" && selectedDates.length > 0 && selectedDates.every((d) => timeAssignments[formatDateISO(d)]))) && (
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

              {/* ── Action Button ── */}
              <PrimaryButton onClick={handleSubmit} disabled={buttonDisabled}>
                {buttonText}
              </PrimaryButton>
            </>
          )}
        </>
        )}
      </div>

      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title="Запись отправлена"
        description={getSuccessDescription()}
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
