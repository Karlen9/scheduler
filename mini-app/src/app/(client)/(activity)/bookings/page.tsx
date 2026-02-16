"use client";

import { useState, useEffect, useMemo } from "react";
import { CalendarX, ChevronDown, Repeat, Eye } from "lucide-react";
import { toast } from "sonner";
import { BookingCard } from "@/components/BookingCard";
import { EmptyState } from "@/components/EmptyState";
import { BookingCardSkeleton, RecurringPageSkeleton } from "@/components/LoadingSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ServiceSelector } from "@/components/ServiceSelector";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { api } from "@/lib/api";
import { Booking, RecurringSchedule, SessionType, WorkingHours } from "@/lib/types";
import { useBookings, useRecurringSchedules, useSessionTypes, useWorkingHours } from "@/hooks/queries";
import { invalidateBookings, invalidateRecurring } from "@/hooks/mutations";

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
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

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

export default function BookingsPage() {
  const [tab, setTab] = useState<"bookings" | "recurring">("bookings");

  // Bookings data
  const { data: bookings, isLoading: bookingsLoading, error: bookingsError } = useBookings();
  const [cancelBookingTarget, setCancelBookingTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showPast, setShowPast] = useState(false);

  // Recurring data
  const { data: schedules, isLoading: schedulesLoading } = useRecurringSchedules();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const { data: workingHours, isLoading: whLoading } = useWorkingHours();
  const recurringLoading = schedulesLoading || servicesLoading || whLoading;

  const [isSaving, setIsSaving] = useState(false);
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [dayTimeMap, setDayTimeMap] = useState<Record<number, string>>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [cancelScheduleTarget, setCancelScheduleTarget] = useState<RecurringSchedule | null>(null);

  const timeSlotsForActiveDay = useMemo(
    () => activeDay !== null ? generateTimeSlotsForDay(workingHours, activeDay, selectedService?.durationMinutes ?? 0) : [],
    [workingHours, activeDay, selectedService],
  );

  useEffect(() => {
    setPreviewDates(null);
  }, [selectedService, dayTimeMap, selectedPeriod]);

  // Bookings derived data
  const activeBookings = bookings
    .filter((b) => b.status === "pending" || b.status === "confirmed" || b.status === "cancel_requested" || b.status === "reschedule_pending")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const pastBookings = bookings
    .filter((b) => b.status === "completed" || b.status === "cancelled" || b.status === "rejected")
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  // Recurring derived data
  const pendingSchedules = schedules.filter((s) => s.status === "pending");
  const activeSchedules = schedules.filter((s) => s.status === "active");
  const declinedSchedules = schedules.filter((s) => s.status === "declined");
  const cancelledSchedules = schedules.filter((s) => s.status === "cancelled");
  const hasSchedules = schedules.length > 0;

  // Booking handlers
  const handleCancelBooking = async () => {
    if (!cancelBookingTarget) return;
    try {
      await api.cancelBooking(cancelBookingTarget.id, cancelReason || "Отменено клиентом");
      toast.success("Запись отменена");
      setCancelBookingTarget(null);
      setCancelReason("");
      invalidateBookings();
    } catch {
      toast.error("Не удалось отменить запись");
    }
  };

  const handleConfirm = async (booking: Booking) => {
    try {
      await api.confirmBooking(booking.id);
      toast.success("Запись подтверждена");
      invalidateBookings();
    } catch {
      toast.error("Не удалось подтвердить запись");
    }
  };

  const handleDecline = async (booking: Booking) => {
    try {
      await api.declineBooking(booking.id);
      toast.success("Запись отклонена");
      invalidateBookings();
    } catch {
      toast.error("Не удалось отклонить запись");
    }
  };

  // Recurring handlers
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

  const handleTimeSelect = (time: string) => {
    if (activeDay === null) return;
    setDayTimeMap((prev) => ({ ...prev, [activeDay]: time }));
    setActiveDay(null);
  };

  const configuredDays = Object.keys(dayTimeMap).map(Number);
  const hasDayTimes = configuredDays.length > 0;
  const formReady = selectedService && hasDayTimes && selectedPeriod;

  const buildDayTimesPayload = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [day, time] of Object.entries(dayTimeMap)) {
      result[day] = time;
    }
    return result;
  };

  const handlePreview = async () => {
    if (!formReady) return;
    setIsPreviewing(true);
    try {
      const result = await api.previewRecurringSchedule({
        sessionTypeId: selectedService.id,
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
    if (!formReady) return;
    setIsSaving(true);
    try {
      await api.createRecurringSchedule({
        sessionTypeId: selectedService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      toast.success("Расписание отправлено на подтверждение");
      setSelectedService(null);
      setDayTimeMap({});
      setActiveDay(null);
      setSelectedPeriod("");
      setPreviewDates(null);
      invalidateRecurring();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания расписания";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!cancelScheduleTarget) return;
    try {
      await api.cancelRecurringSchedule(cancelScheduleTarget.id);
      toast.success("Расписание отменено");
      setCancelScheduleTarget(null);
      invalidateRecurring();
    } catch {
      toast.error("Не удалось отменить расписание");
    }
  };

  // Toggle UI
  const toggleBar = (
    <div className="flex bg-card rounded-xl p-1 mb-4">
      <button
        onClick={() => setTab("bookings")}
        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
          tab === "bookings" ? "bg-brand text-white" : "text-muted-foreground"
        }`}
      >
        Записи
      </button>
      <button
        onClick={() => setTab("recurring")}
        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
          tab === "recurring" ? "bg-brand text-white" : "text-muted-foreground"
        }`}
      >
        Расписания
      </button>
    </div>
  );

  // ---- Bookings tab content ----
  const renderBookingsTab = () => {
    if (bookingsLoading) {
      return (
        <div>
          <div className="h-4 bg-card rounded w-28 mb-3 animate-pulse" />
          <div className="space-y-3">
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </div>
        </div>
      );
    }

    if (bookingsError) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CalendarX className="w-16 h-16" />}
            title="Ошибка загрузки"
            description="Не удалось загрузить записи"
          />
        </div>
      );
    }

    if (bookings.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CalendarX className="w-16 h-16" />}
            title="У вас пока нет записей"
            description="Выберите удобное время и запишитесь на тренировку"
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {activeBookings.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Активные записи
            </h3>
            <div className="space-y-3">
              {activeBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onCancel={setCancelBookingTarget}
                  onConfirm={booking.status === "pending" && booking.createdBy === "trainer" ? handleConfirm : undefined}
                  onDecline={booking.status === "pending" && booking.createdBy === "trainer" ? handleDecline : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {pastBookings.length > 0 && (
          <div>
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showPast ? "rotate-0" : "-rotate-90"}`} />
              Прошедшие записи ({pastBookings.length})
            </button>
            {showPast && (
              <div className="space-y-3">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ---- Recurring tab content ----
  const renderRecurringTab = () => {
    if (recurringLoading) {
      return <RecurringPageSkeleton />;
    }

    return (
      <div className="space-y-6">
        {/* Add Form */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Добавить расписание
          </h3>

          {services.length > 0 && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Услуга
              </label>
              <ServiceSelector
                services={services}
                selectedId={selectedService?.id ?? ""}
                onChange={setSelectedService}
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Дни недели
            </label>
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
                          : "bg-background text-foreground"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedService && activeDay !== null && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Время для {DAY_NAMES_FULL[activeDay]}
              </label>
              {timeSlotsForActiveDay.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {timeSlotsForActiveDay.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleTimeSelect(slot)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        dayTimeMap[activeDay] === slot
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground"
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

          {selectedService && hasDayTimes && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Период
              </label>
              <div className="flex gap-2">
                {PERIODS.map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === period.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {formReady && (
            <div className="space-y-2">
              {!previewDates && (
                <button
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-background text-foreground font-medium text-sm transition-opacity active:opacity-70 disabled:opacity-40"
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
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-background p-3 space-y-1">
                    {previewDates.map((date) => (
                      <div key={date} className="text-sm text-foreground">
                        {formatPreviewDate(date)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <PrimaryButton
                onClick={handleCreateSchedule}
                disabled={isSaving}
              >
                {isSaving ? "Сохранение..." : "Отправить на подтверждение"}
              </PrimaryButton>
            </div>
          )}
        </div>

        {/* Schedules List */}
        {!hasSchedules ? (
          <EmptyState
            icon={<Repeat className="w-16 h-16" />}
            title="Нет регулярных тренировок"
            description="Добавьте расписание, чтобы автоматически бронировать тренировки каждую неделю"
          />
        ) : (
          <>
            {pendingSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Ожидают подтверждения
                </h3>
                <div className="space-y-3">
                  {pendingSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                      onCancel={setCancelScheduleTarget}
                      detailPath="/recurring"
                    />
                  ))}
                </div>
              </div>
            )}

            {activeSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Активные расписания
                </h3>
                <div className="space-y-3">
                  {activeSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                      onCancel={setCancelScheduleTarget}
                      detailPath="/recurring"
                    />
                  ))}
                </div>
              </div>
            )}

            {declinedSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Отклоненные
                </h3>
                <div className="space-y-3">
                  {declinedSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                    />
                  ))}
                </div>
              </div>
            )}

            {cancelledSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Отмененные ({cancelledSchedules.length})
                </h3>
                <div className="space-y-3">
                  {cancelledSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold px-1">Мои записи</h2>
        {toggleBar}
        {tab === "bookings" ? renderBookingsTab() : renderRecurringTab()}
      </div>

      {/* Cancel booking dialog */}
      <ConfirmDialog
        isOpen={!!cancelBookingTarget}
        onClose={() => { setCancelBookingTarget(null); setCancelReason(""); }}
        onConfirm={handleCancelBooking}
        title="Отменить запись?"
        description="Вы уверены, что хотите отменить эту запись? Это действие нельзя отменить."
        confirmText="Отменить запись"
        destructive
        showInput
        inputPlaceholder="Причина отмены (необязательно)"
        inputValue={cancelReason}
        onInputChange={setCancelReason}
      />

      {/* Cancel schedule dialog */}
      <ConfirmDialog
        isOpen={!!cancelScheduleTarget}
        onClose={() => setCancelScheduleTarget(null)}
        onConfirm={handleCancelSchedule}
        title="Отменить расписание?"
        description="Регулярные тренировки по этому расписанию больше не будут создаваться автоматически."
        confirmText="Отменить"
        destructive
      />
    </div>
  );
}
