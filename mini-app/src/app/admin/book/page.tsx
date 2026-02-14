"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { ActivityBackButton } from "@/components/ActivityBackButton";
import { ClientListSkeleton } from "@/components/LoadingSkeleton";
import { ServiceSelector } from "@/components/ServiceSelector";
import { CalendarView } from "@/components/CalendarView";
import { TimeSlotGrid } from "@/components/TimeSlotGrid";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SuccessModal } from "@/components/SuccessModal";
import { EmptyState } from "@/components/EmptyState";
import { formatDuration } from "@/components/DurationSelector";
import { api } from "@/lib/api";
import { ClientInfo, SessionType, TimeSlot } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";
import { useClients, useAdminServices, useWorkingHours, useDaysOff } from "@/hooks/queries";
import { invalidateBookings } from "@/hooks/mutations";

type Step = "client" | "date" | "time";

export default function AdminBookPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("client");

  // SWR hooks for initial data
  const { data: clients, isLoading: isClientsLoading } = useClients();
  const { data: services, isLoading: isServicesLoading } = useAdminServices();
  const { data: workingHoursData, isLoading: isWorkingHoursLoading } = useWorkingHours();
  const { data: daysOffData, isLoading: isDaysOffLoading } = useDaysOff();

  const isInitialLoading = isClientsLoading || isServicesLoading || isWorkingHoursLoading || isDaysOffLoading;

  // Derive nonWorkingDays from workingHoursData
  const nonWorkingDays = useMemo(() => {
    const workingDaySet = new Set(workingHoursData.map((wh) => wh.dayOfWeek));
    const nonWorking: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (!workingDaySet.has(i)) {
        nonWorking.push(i);
      }
    }
    return nonWorking;
  }, [workingHoursData]);

  // Derive daysOff strings from daysOffData
  const daysOff = useMemo(() => {
    return daysOffData.map((d) => d.date);
  }, [daysOffData]);

  // Client selection
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Service
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);

  // Date & time
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noSlotsAvailable, setNoSlotsAvailable] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState("");

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)),
    );
  }, [clients, searchQuery]);

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


  // Auto-select first service when services load
  useEffect(() => {
    if (services.length === 1 && !selectedService) {
      setSelectedService(services[0]);
    }
  }, [services]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectClient = (client: ClientInfo) => {
    setSelectedClient(client);
    setStep("date");
  };

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
    if (!selectedClient || !selectedDate || !selectedTime || !selectedService)
      return;

    setIsSubmitting(true);
    try {
      const dateStr = formatDateISO(selectedDate);
      await api.admin.createBooking({
        clientId: selectedClient.id,
        duration: selectedService.durationMinutes,
        date: dateStr,
        time: selectedTime,
        message: message || undefined,
      });
      invalidateBookings();
      setShowSuccess(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Не удалось создать запись";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.push("/admin");
  };

  const handleBack = () => {
    if (step === "time") {
      setStep("date");
      setSelectedTime(null);
    } else if (step === "date") {
      setStep("client");
      setSelectedClient(null);
      setSelectedDate(null);
    } else {
      router.back();
    }
  };

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

  const canConfirm = selectedClient && selectedDate && selectedTime && selectedService && !isSubmitting;

  const stepTitle = () => {
    switch (step) {
      case "client":
        return "Выберите клиента";
      case "date":
        return "Выберите дату";
      case "time":
        return "Выберите время";
    }
  };

  return (
    <div className="flex flex-col">
      <ActivityBackButton href="/admin" />

      <div className="flex-1 p-4 space-y-4 pb-24">
        {isInitialLoading ? (
          <ClientListSkeleton />
        ) : (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {selectedClient && step !== "client" && (
                <button
                  onClick={() => { setStep("client"); setSelectedClient(null); }}
                  className="text-primary underline underline-offset-2"
                >
                  {selectedClient.name}
                </button>
              )}
              {selectedDate && (step === "time") && (
                <>
                  <span>&rarr;</span>
                  <button
                    onClick={() => { setStep("date"); setSelectedTime(null); }}
                    className="text-primary underline underline-offset-2"
                  >
                    {formatDate(selectedDate)}
                  </button>
                </>
              )}
            </div>

            {/* Step: Select Client */}
            {step === "client" && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {stepTitle()}
                </h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по имени или телефону"
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand text-base"
                  />
                </div>
                {filteredClients.length === 0 ? (
                  <EmptyState
                    icon={<AlertCircle className="w-16 h-16" />}
                    title="Клиенты не найдены"
                    description={
                      clients.length === 0
                        ? "Пока нет зарегистрированных клиентов"
                        : "Попробуйте изменить запрос поиска"
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className={`w-full bg-card rounded-xl p-4 flex items-center gap-3 transition-colors text-left ${
                          selectedClient?.id === client.id
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                      >
                        <ClientAvatar name={client.name} photoUrl={client.photoUrl} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {client.name}
                          </div>
                          {client.phone && (
                            <div className="text-sm text-muted-foreground">
                              {client.phone}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step: Select Service + Date */}
            {(step === "date" || step === "time") && (
              <>
                {services.length > 1 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Услуга
                    </h3>
                    <ServiceSelector
                      services={services}
                      selectedId={selectedService?.id ?? ""}
                      onChange={handleServiceChange}
                    />
                    {!selectedService && (
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
                        <span className="font-medium">
                          {formatDate(selectedDate)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Loading time slots */}
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

            {/* Step: Select Time */}
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

            {/* Comment */}
            {step === "time" && selectedTime && !noSlotsAvailable && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Комментарий
                </h3>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Комментарий к записи (необязательно)"
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-lg bg-card text-foreground outline-none focus:ring-2 focus:ring-brand resize-none text-base"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Time step: Confirm button */}
      {step === "time" && !noSlotsAvailable && (
        <div
          className="fixed bottom-[88px] left-0 right-0 p-4 bg-background border-t border-border"
          style={{ maxWidth: "430px", margin: "0 auto" }}
        >
          <PrimaryButton
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isSubmitting ? "Отправка..." : "Подтвердить запись"}
          </PrimaryButton>
        </div>
      )}

      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title="Запись создана"
        description={`${selectedClient?.name} записан(а) на ${selectedDate ? formatDate(selectedDate) : ""} в ${selectedTime}${selectedService ? ` — ${selectedService.name}` : ""}.`}
      />
    </div>
  );
}
