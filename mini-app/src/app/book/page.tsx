"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SessionType, TimeSlot, WorkingHours, Trainer } from "@/lib/types";
import { WeekCalendar } from "@/components/WeekCalendar";
import { TimeSlots } from "@/components/TimeSlots";
import { Loading } from "@/components/Loading";
import { getTelegramWebApp, getUserName } from "@/lib/telegram";

export default function BookPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [clientMessage, setClientMessage] = useState<string>("");

  useEffect(() => {
    const webApp = getTelegramWebApp();
    webApp?.BackButton.show();

    const handleBack = () => {
      router.push("/");
    };

    webApp?.BackButton.onClick(handleBack);

    return () => {
      webApp?.BackButton.offClick(handleBack);
      webApp?.BackButton.hide();
    };
  }, [router]);

  useEffect(() => {
    // Set initial name from Telegram
    const name = getUserName();
    if (name && name !== "Гость") {
      setClientName(name);
    }

    Promise.all([
      api.getTrainer(),
      api.getSessionTypes(),
      api.getWorkingHours()
    ]).then(([t, types, hours]) => {
      setTrainer(t);
      setSessionTypes(types);
      setWorkingHours(hours);
      if (types.length > 0) {
        setSelectedService(types[0]);
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedDate && selectedService) {
      setSlotsLoading(true);
      setSelectedTime(null);
      api.getAvailableSlots(selectedDate, selectedService.type).then((s) => {
        setSlots(s);
        setSlotsLoading(false);
      });
    }
  }, [selectedDate, selectedService]);

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !clientName.trim()) return;

    setIsSubmitting(true);
    try {
      await api.createBooking(
        selectedService.type,
        selectedDate,
        selectedTime,
        clientName.trim(),
        clientMessage.trim() || undefined
      );
      router.push("/bookings?success=1");
    } catch (error) {
      console.error("Booking failed:", error);
      setIsSubmitting(false);
    }
  };

  const workingDays = workingHours.map((wh) => wh.dayOfWeek);
  const canBook = selectedService && selectedDate && selectedTime && clientName.trim();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E8EEF4]">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8EEF4] flex flex-col">
      {/* Header with trainer photo */}
      <div className="relative flex-shrink-0">
        {/* Top bar with back and share buttons */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="w-10 h-10 rounded-full bg-white/80 backdrop-blur flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
          </button>
        </div>

        {/* Trainer info and photo area */}
        <div className="pt-16 pb-8 px-6 flex items-end justify-between min-h-[280px]">
          <div className="flex-1 pb-4">
            <p className="text-gray-500 text-sm mb-1">Фитнес-тренер</p>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              {trainer?.name?.split(' ').map((word, i) => (
                <span key={i}>
                  {word}
                  {i === 0 && <br />}
                </span>
              ))}
            </h1>
          </div>
          {/* Trainer photo placeholder */}
          <div className="w-40 h-48 relative -mr-2">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-200 to-orange-300 rounded-2xl flex items-end justify-center overflow-hidden">
              <svg width="120" height="140" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="0.8" className="opacity-40">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* White card with booking options */}
      <div className="flex-1 bg-white rounded-t-[32px] px-6 pt-8 pb-32 -mt-4 relative z-10">
        {/* Date selector */}
        <div className="mb-8">
          <WeekCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            workingDays={workingDays}
          />
        </div>

        {/* Time selector */}
        {selectedDate ? (
          <TimeSlots
            slots={slots}
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
            isLoading={slotsLoading}
          />
        ) : (
          <div className="text-center py-8 text-gray-400">
            Выберите дату
          </div>
        )}

        {/* Client info fields */}
        {selectedTime && (
          <div className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ваше имя *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Введите ваше имя"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4A90D9] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Сообщение тренеру (необязательно)
              </label>
              <textarea
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                placeholder="Напишите, если есть особые пожелания"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4A90D9] focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-white">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0" />

          {/* Book button */}
          <button
            onClick={handleConfirm}
            disabled={!canBook || isSubmitting}
            className={`
              flex-1 py-4 rounded-full text-base font-semibold transition-all
              ${canBook && !isSubmitting
                ? "bg-[#4A90D9] text-white active:scale-[0.98]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }
            `}
          >
            {isSubmitting ? "Загрузка..." : "Забронировать время"}
          </button>
        </div>
      </div>
    </div>
  );
}
