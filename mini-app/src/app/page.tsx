"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { TrainerCard } from "@/components/TrainerCard";
import { WeekDatePicker } from "@/components/WeekDatePicker";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { BottomSafeArea } from "@/components/BottomSafeArea";
import { initTelegramApp } from "@/lib/telegram";

export default function HomePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    initTelegramApp();
  }, []);

  const handleServices = () => {
    // Navigate to services page or show modal
    console.log("Opening services...");
  };

  const handleShare = () => {
    // Share trainer profile
    console.log("Sharing profile...");
  };

  const handleBooking = () => {
    if (selectedDate && selectedTime) {
      const dateStr = selectedDate.toISOString();
      router.push(
        `/book?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(selectedTime)}`,
      );
    } else {
      router.push("/book");
    }
  };

  const handleMyBookings = () => {
    router.push("/bookings");
  };

  return (
    <div
      className="min-h-screen bg-[#f1f5fe]"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      {/* Main Content */}
      <div className="px-4 pt-4 pb-32 space-y-6">
        {/* Trainer Card */}
        <TrainerCard
          name="Карлен Мисакян"
          specialization="Фитнес-тренер в Spirit Fitnes"
          bio="Я научу тебя как разъёбывать лайн на тройке, пятёрке или четвёрке. Ну и прес качат и анжуманя ещё. Я научу тебя как разъёбывать лайн на тройке, пятёрке или четвёрке."
          phone="+7(987)654-32-10"
          telegram="@karlenptsd"
          onServices={handleServices}
          onShare={handleShare}
        />

        {/* Online Booking Section */}
        <div className="bg-white rounded-[30px] px-4 py-6 shadow-sm">
          <h2 className="text-lg font-medium text-[#101010] text-center mb-6">
            Онлайн запись
          </h2>

          <div className="border-t border-[#e9e9e9] mb-6" />

          {/* Week Date Picker */}
          <WeekDatePicker
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {/* Time Slot Picker */}
          <div className="mt-6">
            <TimeSlotPicker
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
            />
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white shadow-[0px_-10px_4px_0px_rgba(219,219,219,0.25)]"
        style={{ maxWidth: "430px", margin: "0 auto" }}
      >
        <div className="px-4 py-4 flex gap-3">
          {/* Calendar Icon Button */}
          <button
            onClick={handleMyBookings}
            className="w-12 h-12 rounded-[9px] bg-[#d9d9d9] flex items-center justify-center transition-opacity active:opacity-70"
          >
            <Calendar className="w-6 h-6 text-[#676767]" />
          </button>

          {/* Main Booking Button */}
          <button
            onClick={handleBooking}
            className="flex-1 h-12 rounded-[28px] bg-[#5984d8] text-white text-lg font-medium transition-opacity active:opacity-80"
          >
            Записаться
          </button>
        </div>
        <BottomSafeArea />
      </div>
    </div>
  );
}
