"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Clock, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { CalendarSkeleton } from "@/components/LoadingSkeleton";
import { CalendarView } from "@/components/CalendarView";
import { TimeSlotGrid } from "@/components/TimeSlotGrid";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SuccessModal } from "@/components/SuccessModal";
import { EmptyState } from "@/components/EmptyState";
import { ServiceSelector } from "@/components/ServiceSelector";
import { ClientAvatar } from "@/components/ClientAvatar";
import { api } from "@/lib/api";
import { ClientInfo, SessionType, TimeSlot, WorkingHours } from "@/lib/types";
import { invalidateBookings, invalidateRecurring } from "@/hooks/mutations";

// ──── Constants ────

const MONTH_SHORT = ["Янв", "Фев", "Мар", "Апр", "Мая", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MONTHS_FULL = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const DAYS = [
  { label: "Пн", value: 1 },
  { label: "Вт", value: 2 },
  { label: "Ср", value: 3 },
  { label: "Чт", value: 4 },
  { label: "Пт", value: 5 },
  { label: "Сб", value: 6 },
  { label: "Вс", value: 0 },
];
const PERIODS = [
  { label: "1 неделя", value: "1week" },
  { label: "1 месяц", value: "1month" },
  { label: "3 месяца", value: "3months" },
];
const DAY_NAMES_FULL: Record<number, string> = {
  0: "Вс", 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб",
};
const MONTH_NAMES = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// ──── Helpers ────

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

function formatPreviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dayName = DAY_NAMES_FULL[d.getDay()] || "?";
  return `${dayName}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function generateTimeSlotsForDay(workingHours: WorkingHours[], day: number, durationMinutes: number): string[] {
  if (durationMinutes <= 0) return [];
  const wh = workingHours.find((h) => h.dayOfWeek === day);
  if (!wh) return [];
  const [startH, startM] = wh.startTime.split(":").map(Number);
  const [endH, endM] = wh.endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const slots: string[] = [];
  for (let m = startMin; m + durationMinutes <= endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

// ──── Sub-components ────

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

// ──── Types ────

export interface CreateBookingParams {
  clientId?: string;
  duration: number;
  date: string;
  time: string;
  message?: string;
}

export interface CreateRecurringParams {
  clientId?: string;
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
}

export interface PreviewRecurringParams {
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
}

export interface BookingFormProps {
  services: SessionType[];
  workingHours: WorkingHours[];
  daysOff: string[];
  isLoading: boolean;
  clients?: ClientInfo[];
  showRecurring?: boolean;
  onCreateBooking: (params: CreateBookingParams) => Promise<void>;
  onCreateRecurring: (params: CreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: PreviewRecurringParams) => Promise<{ dates: string[] }>;
  onCreateGhostClient?: (name: string) => Promise<ClientInfo>;
  successRedirect: string;
  title?: string;
}

// ──── Main Component ────

export function BookingForm({
  services,
  workingHours: workingHoursData,
  daysOff,
  isLoading: isInitialLoading,
  clients,
  showRecurring = true,
  onCreateBooking,
  onCreateRecurring,
  onPreviewRecurring,
  onCreateGhostClient,
  successRedirect,
  title = "Онлайн запись",
}: BookingFormProps) {
  const router = useRouter();
  const hasClientSelector = !!clients;

  // ═══════════════════════════════
  // Client selection (admin only)
  // ═══════════════════════════════
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingGhost, setIsCreatingGhost] = useState(false);

  const handleCreateGhostClient = async () => {
    if (!onCreateGhostClient || !searchQuery.trim()) return;
    setIsCreatingGhost(true);
    try {
      const client = await onCreateGhostClient(searchQuery.trim());
      setSelectedClient(client);
      setSearchQuery("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось создать клиента";
      toast.error(msg);
    } finally {
      setIsCreatingGhost(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)),
    );
  }, [clients, searchQuery]);

  // ═══════════════════════════════
  // Top-level mode
  // ═══════════════════════════════
  const [bookingType, setBookingType] = useState<"onetime" | "recurring">("onetime");

  // ═══════════════════════════════
  // ONE-TIME booking state
  // ═══════════════════════════════
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [activeDateISO, setActiveDateISO] = useState<string | null>(null);
  const [timeAssignments, setTimeAssignments] = useState<Record<string, string>>({});
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState("");

  // ═══════════════════════════════
  // RECURRING booking state
  // ═══════════════════════════════
  const [recService, setRecService] = useState<SessionType | null>(null);
  const [dayTimeMap, setDayTimeMap] = useState<Record<number, string>>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRecSuccess, setShowRecSuccess] = useState(false);

  // ═══════════════════════════════
  // Shared computed
  // ═══════════════════════════════
  const nonWorkingDays = useMemo(() => {
    const workingDaySet = new Set(workingHoursData.map((wh) => wh.dayOfWeek));
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (!workingDaySet.has(i)) result.push(i);
    }
    return result;
  }, [workingHoursData]);

  // Auto-select first service when only one exists
  useEffect(() => {
    if (services.length === 1 && !selectedService) {
      setSelectedService(services[0]);
    }
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset one-time selections when mode changes
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

  // Reset recurring preview when config changes
  useEffect(() => {
    setPreviewDates(null);
  }, [recService, dayTimeMap, selectedPeriod]);

  const timeSlotsForActiveDay = useMemo(
    () => activeDay !== null ? generateTimeSlotsForDay(workingHoursData, activeDay, recService?.durationMinutes ?? 0) : [],
    [workingHoursData, activeDay, recService],
  );

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

  // ──── One-time: Service handlers ────

  const handleServiceSelect = (service: SessionType) => {
    const changed = selectedService?.id !== service.id;
    setSelectedService(service);
    if (changed) {
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

  // ──── One-time: Single mode handlers ────

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

  // ──── One-time: Multi mode handlers ────

  const handleMultiDateToggle = (date: Date) => {
    const iso = formatDateISO(date);
    const exists = selectedDates.some((d) => formatDateISO(d) === iso);

    if (exists) {
      const newDates = selectedDates.filter((d) => formatDateISO(d) !== iso);
      setSelectedDates(newDates);
      setTimeAssignments((prev) => {
        const next = { ...prev };
        delete next[iso];
        return next;
      });
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
      if (selectedDates.length >= 6) return;
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

    const currentIndex = selectedDates.findIndex((d) => formatDateISO(d) === activeDateISO);
    for (let i = currentIndex + 1; i < selectedDates.length; i++) {
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      const iso = formatDateISO(selectedDates[i]);
      if (!newAssignments[iso]) {
        setActiveDateISO(iso);
        fetchSlots(selectedDates[i], selectedService.durationMinutes);
        return;
      }
    }
  };

  // ──── One-time: Submit ────

  const handleSingleSubmit = async () => {
    if (!selectedDate || !selectedTime || !selectedService) return;
    if (hasClientSelector && !selectedClient) return;
    setIsSubmitting(true);
    try {
      const dateStr = formatDateISO(selectedDate);
      await onCreateBooking({
        clientId: selectedClient?.id,
        duration: selectedService.durationMinutes,
        date: dateStr,
        time: selectedTime,
        message: message || undefined,
      });
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
    if (hasClientSelector && !selectedClient) return;
    setIsSubmitting(true);
    try {
      for (const date of selectedDates) {
        const iso = formatDateISO(date);
        const time = timeAssignments[iso];
        if (!time) continue;
        await onCreateBooking({
          clientId: selectedClient?.id,
          duration: selectedService.durationMinutes,
          date: iso,
          time,
          message: message || undefined,
        });
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

  const handleOnetimeSubmit = () => {
    if (mode === "single") handleSingleSubmit();
    else handleMultiSubmit();
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push(successRedirect);
  };

  // ──── Recurring handlers ────

  const handleDayClick = (day: number) => {
    if (activeDay === day) {
      setDayTimeMap((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
      setActiveDay(null);
    } else if (day in dayTimeMap) {
      setActiveDay(day);
    } else {
      setActiveDay(day);
    }
  };

  const handleRecTimeSelect = (time: string) => {
    if (activeDay === null) return;
    setDayTimeMap((prev) => ({ ...prev, [activeDay]: time }));
    setActiveDay(null);
  };

  const configuredDays = Object.keys(dayTimeMap).map(Number);
  const hasDayTimes = configuredDays.length > 0;
  const recFormReady = recService && hasDayTimes && selectedPeriod && (!hasClientSelector || selectedClient);

  const buildDayTimesPayload = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [day, time] of Object.entries(dayTimeMap)) {
      result[day] = time;
    }
    return result;
  };

  const handlePreview = async () => {
    if (!recFormReady) return;
    setIsPreviewing(true);
    try {
      const result = await onPreviewRecurring({
        sessionTypeId: recService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      setPreviewDates(result.dates);
    } catch {
      toast.error("Не удалось загрузить предпросмотр");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!recFormReady) return;
    setIsSaving(true);
    try {
      await onCreateRecurring({
        clientId: selectedClient?.id,
        sessionTypeId: recService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      setRecService(null);
      setDayTimeMap({});
      setActiveDay(null);
      setSelectedPeriod("");
      setPreviewDates(null);
      invalidateRecurring();
      setShowRecSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания расписания";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecSuccessClose = () => {
    setShowRecSuccess(false);
    router.push(successRedirect);
  };

  // ──── Button state (one-time) ────

  const getOnetimeButtonState = () => {
    if (hasClientSelector && !selectedClient) return { text: "Выберите клиента", disabled: true };
    if (!selectedService) return { text: "Выберите услугу", disabled: true };
    if (mode === "single") {
      if (!selectedDate) return { text: "Выберите дату", disabled: true };
      if (!selectedTime) return { text: "Выберите время", disabled: true };
      return { text: isSubmitting ? "Отправка..." : "Записать", disabled: isSubmitting };
    } else {
      if (selectedDates.length === 0) return { text: "Выберите дни", disabled: true };
      const allAssigned = selectedDates.every((d) => timeAssignments[formatDateISO(d)]);
      if (!allAssigned) return { text: "Выберите время", disabled: true };
      return { text: isSubmitting ? "Отправка..." : "Записать", disabled: isSubmitting };
    }
  };

  const { text: onetimeButtonText, disabled: onetimeButtonDisabled } = getOnetimeButtonState();
  const multiActiveTime = activeDateISO ? timeAssignments[activeDateISO] ?? null : null;

  const getOnetimeSuccessDescription = () => {
    const isGhost = selectedClient?.isGhost;
    if (mode === "single" && selectedDate && selectedTime && selectedService) {
      const prefix = selectedClient ? `${selectedClient.name} записан(а)` : "Вы записаны";
      const suffix = isGhost ? "" : " Ожидайте подтверждения.";
      return `${prefix} на ${selectedDate.getDate()} ${MONTHS_FULL[selectedDate.getMonth()]} в ${selectedTime} — ${selectedService.name}.${suffix}`;
    }
    if (mode === "multi") {
      const suffix = selectedClient ? ` для ${selectedClient.name}` : "";
      const confirm = isGhost ? "" : " Ожидайте подтверждения.";
      return `Создано записей: ${selectedDates.length}${suffix}.${confirm}`;
    }
    return isGhost ? "Запись создана." : "Ожидайте подтверждения.";
  };

  // Whether to show the booking form (client selector passed or not needed)
  const showForm = !hasClientSelector || selectedClient;

  // ──── Render ────

  return (
    <div className="flex flex-col">
      <div className="flex-1 p-4 space-y-4 pb-24">
        <h2 className="text-lg font-semibold px-1">{title}</h2>

        {/* ══ Client Selector (admin only) ══ */}
        {hasClientSelector && !selectedClient && (
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Выберите клиента</label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени или телефону"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand text-sm"
              />
            </div>
            {filteredClients.length === 0 ? (
              <div className="space-y-3">
                {onCreateGhostClient && searchQuery.trim() && (
                  <button
                    onClick={handleCreateGhostClient}
                    disabled={isCreatingGhost}
                    className="w-full border-2 border-dashed border-border rounded-xl p-4 text-sm text-muted-foreground transition-colors active:bg-card disabled:opacity-50"
                  >
                    {isCreatingGhost ? "Создание..." : `Добавить «${searchQuery.trim()}»`}
                  </button>
                )}
                <EmptyState
                  icon={<AlertCircle className="w-16 h-16" />}
                  title="Клиенты не найдены"
                  description={
                    clients!.length === 0
                      ? "Пока нет зарегистрированных клиентов"
                      : "Попробуйте изменить запрос поиска"
                  }
                />
              </div>
            ) : (
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => { setSelectedClient(client); setSearchQuery(""); }}
                    className="w-full bg-card rounded-xl p-4 flex items-center gap-3 transition-colors text-left"
                  >
                    <ClientAvatar name={client.name} photoUrl={client.photoUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {client.name}
                        {client.isGhost && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(гость)</span>
                        )}
                      </div>
                      {client.phone && (
                        <div className="text-sm text-muted-foreground">{client.phone}</div>
                      )}
                    </div>
                  </button>
                ))}
                {onCreateGhostClient && searchQuery.trim() && !filteredClients.some(c => c.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                  <button
                    onClick={handleCreateGhostClient}
                    disabled={isCreatingGhost}
                    className="w-full border-2 border-dashed border-border rounded-xl p-4 text-sm text-muted-foreground transition-colors active:bg-card disabled:opacity-50"
                  >
                    {isCreatingGhost ? "Создание..." : `Добавить «${searchQuery.trim()}»`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ Selected client header (admin) ══ */}
        {hasClientSelector && selectedClient && (
          <div className="flex items-center gap-3 bg-card rounded-xl p-3">
            <ClientAvatar name={selectedClient.name} photoUrl={selectedClient.photoUrl} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {selectedClient.name}
                {selectedClient.isGhost && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">(гость)</span>
                )}
              </p>
              {selectedClient.phone && (
                <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              className="text-xs text-brand font-medium"
            >
              Изменить
            </button>
          </div>
        )}

        {/* ══ Booking form ══ */}
        {showForm && (
          <>
            {/* Top-level toggle: one-time / recurring */}
            {showRecurring && (
              <div className="flex bg-card rounded-xl p-1">
                <button
                  onClick={() => setBookingType("onetime")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                    bookingType === "onetime" ? "bg-brand text-white" : "text-muted-foreground"
                  }`}
                >
                  Разовая
                </button>
                <button
                  onClick={() => setBookingType("recurring")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                    bookingType === "recurring" ? "bg-brand text-white" : "text-muted-foreground"
                  }`}
                >
                  Регулярная
                </button>
              </div>
            )}

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
            ) : bookingType === "onetime" ? (
              /* ═══════════════════════════════════════════
                 ONE-TIME BOOKING FLOW
                 ═══════════════════════════════════════════ */
              <>
                {/* Service Selection */}
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
                    <ServiceCard
                      service={selectedService}
                      selected
                      onSelect={() => {}}
                      onEdit={handleEditService}
                    />

                    {/* Single/Multi mode toggle */}
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
                          {showRecurring ? "Одиночный выбор" : "Разовая"}
                        </button>
                        <button
                          onClick={() => setMode("multi")}
                          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                            mode === "multi" ? "bg-brand text-white" : "text-muted-foreground"
                          }`}
                        >
                          {showRecurring ? "Множественный выбор" : "Регулярная"}
                        </button>
                      </div>

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

                    {/* Time Slots Loading */}
                    {isLoadingSlots && timeSlots.length === 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Выберите время</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="py-3 rounded-lg bg-card animate-pulse text-sm text-transparent text-center">00:00</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Single Mode: Time Slots */}
                    {mode === "single" && selectedDate && timeSlots.length > 0 && (
                      <div className={`transition-opacity duration-200 ${isLoadingSlots ? "opacity-40 pointer-events-none" : ""}`}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Выберите время</h3>
                        <TimeSlotLegend />
                        {noSlotsAvailable ? (
                          <EmptyState
                            icon={<AlertCircle className="w-16 h-16" />}
                            title="Нет доступных слотов"
                            description="На выбранную дату нет свободного времени. Попробуйте другой день."
                          />
                        ) : (
                          <TimeSlotGrid slots={timeSlots} selected={selectedTime} onSelect={handleSingleTimeSelect} />
                        )}
                      </div>
                    )}

                    {/* Single Mode: Summary */}
                    {mode === "single" && selectedDate && selectedService && !noSlotsAvailable && (
                      <BookingSummary date={selectedDate} service={selectedService} time={selectedTime} />
                    )}

                    {/* Multi Mode: Time Slots + Chips */}
                    {mode === "multi" && selectedDates.length > 0 && (
                      <>
                        {activeDateISO && timeSlots.length > 0 && (
                          <div className={`transition-opacity duration-200 ${isLoadingSlots ? "opacity-40 pointer-events-none" : ""}`}>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Выберите время</h3>
                            <TimeSlotLegend />
                            {noSlotsAvailable ? (
                              <EmptyState
                                icon={<AlertCircle className="w-16 h-16" />}
                                title="Нет доступных слотов"
                                description="На выбранную дату нет свободного времени. Попробуйте другой день."
                              />
                            ) : (
                              <TimeSlotGrid slots={timeSlots} selected={multiActiveTime} onSelect={handleMultiTimeSelect} />
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1">
                          {selectedDates.map((date) => {
                            const iso = formatDateISO(date);
                            const time = timeAssignments[iso];
                            const endTime = time && selectedService ? addMinutesToTime(time, selectedService.durationMinutes) : undefined;
                            return (
                              <DateChip key={iso} date={date} time={time} endTime={endTime} active={activeDateISO === iso} onClick={() => handleChipTap(date)} />
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Comment */}
                    {((mode === "single" && selectedTime && !noSlotsAvailable) ||
                      (mode === "multi" && selectedDates.length > 0 && selectedDates.every((d) => timeAssignments[formatDateISO(d)]))) && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Комментарий</h3>
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

                    {/* Action Button */}
                    <PrimaryButton onClick={handleOnetimeSubmit} disabled={onetimeButtonDisabled}>
                      {onetimeButtonText}
                    </PrimaryButton>
                  </>
                )}
              </>
            ) : (
              /* ═══════════════════════════════════════════
                 RECURRING BOOKING FLOW
                 ═══════════════════════════════════════════ */
              <div className="space-y-4">
                {/* Service */}
                {services.length > 0 && (
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Услуга</label>
                    <ServiceSelector
                      services={services}
                      selectedId={recService?.id ?? ""}
                      onChange={setRecService}
                    />
                  </div>
                )}

                {/* Days of week */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Дни недели</label>
                  <div className="flex gap-2">
                    {DAYS.map((day) => {
                      const isConfigured = day.value in dayTimeMap;
                      const isActive = activeDay === day.value;
                      return (
                        <button
                          key={day.value}
                          onClick={() => handleDayClick(day.value)}
                          className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                              : isConfigured
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-foreground"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots for active day */}
                {recService && activeDay !== null && (
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Время для {DAY_NAMES_FULL[activeDay]}
                    </label>
                    {timeSlotsForActiveDay.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {timeSlotsForActiveDay.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => handleRecTimeSelect(slot)}
                            className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              dayTimeMap[activeDay] === slot
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-foreground"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Нет доступных слотов для {DAY_NAMES_FULL[activeDay]}
                      </p>
                    )}
                  </div>
                )}

                {/* Configured days summary */}
                {hasDayTimes && activeDay === null && (
                  <div className="space-y-1">
                    {DAYS.filter((d) => d.value in dayTimeMap).map((d) => (
                      <div key={d.value} className="flex items-center justify-between text-sm px-1">
                        <span className="text-foreground">{d.label}</span>
                        <span className="text-muted-foreground">{dayTimeMap[d.value]}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Period */}
                {recService && hasDayTimes && (
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Период</label>
                    <div className="flex gap-2">
                      {PERIODS.map((period) => (
                        <button
                          key={period.value}
                          onClick={() => setSelectedPeriod(period.value)}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            selectedPeriod === period.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-foreground"
                          }`}
                        >
                          {period.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview & Submit */}
                {recFormReady && (
                  <div className="space-y-2">
                    {!previewDates && (
                      <button
                        onClick={handlePreview}
                        disabled={isPreviewing}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-card text-foreground font-medium text-sm transition-opacity active:opacity-70 disabled:opacity-40"
                      >
                        <Eye className="w-4 h-4" />
                        {isPreviewing ? "Загрузка..." : "Предпросмотр"}
                      </button>
                    )}

                    {previewDates && (
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">
                          Будет создано тренировок: {previewDates.length}
                        </label>
                        <div className="max-h-40 overflow-y-auto rounded-lg bg-card p-3 space-y-1">
                          {previewDates.map((date) => (
                            <div key={date} className="text-sm text-foreground">
                              {formatPreviewDate(date)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <PrimaryButton onClick={handleCreateSchedule} disabled={isSaving}>
                      {isSaving ? "Сохранение..." : "Отправить на подтверждение"}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* One-time success */}
      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title="Запись создана"
        description={getOnetimeSuccessDescription()}
      />

      {/* Recurring success */}
      <SuccessModal
        isOpen={showRecSuccess}
        onClose={handleRecSuccessClose}
        title="Расписание отправлено"
        description={selectedClient
          ? `Расписание для ${selectedClient.name} отправлено на подтверждение.`
          : "Расписание отправлено на подтверждение тренеру."
        }
      />
    </div>
  );
}
