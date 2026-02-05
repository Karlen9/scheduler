"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { TrainerCard } from "@/components/TrainerCard";
import { BottomSafeArea } from "@/components/BottomSafeArea";
import { initTelegramApp } from "@/lib/telegram";
import { api } from "@/lib/api";
import { Trainer } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initTelegramApp();

    api.getTrainer()
      .then(setTrainer)
      .catch((err) => console.error("Failed to load trainer:", err))
      .finally(() => setIsLoading(false));
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
    router.push("/book");
  };

  const handleMyBookings = () => {
    router.push("/bookings");
  };

  return (
    <div
      className="min-h-screen bg-background"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      {/* Main Content */}
      <div className="px-4 pt-4 pb-32 space-y-6">
        {/* Trainer Card */}
        {isLoading ? (
          <div className="bg-card rounded-xl p-4 animate-pulse">
            <div className="flex gap-4 mb-4">
              <div className="w-[127px] h-[127px] rounded-full bg-border" />
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-border rounded w-3/4" />
                <div className="h-4 bg-border rounded w-1/2" />
                <div className="h-3 bg-border rounded w-2/3" />
              </div>
            </div>
            <div className="h-16 bg-border rounded mb-4" />
            <div className="flex gap-2">
              <div className="flex-1 h-12 bg-border rounded-[28px]" />
              <div className="flex-1 h-12 bg-border rounded-[28px]" />
              <div className="w-12 h-12 bg-border rounded-[28px]" />
            </div>
          </div>
        ) : trainer ? (
          <TrainerCard
            name={trainer.name}
            specialization={trainer.specialization || ""}
            bio={trainer.bio || ""}
            photoUrl={trainer.photoUrl}
            phone={trainer.phone}
            telegram={trainer.telegramHandle}
            onServices={handleServices}
            onShare={handleShare}
          />
        ) : (
          <div className="bg-card rounded-xl p-4 text-center text-muted-foreground">
            Не удалось загрузить информацию о тренере
          </div>
        )}
      </div> 

      {/* Fixed Bottom Button */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-card shadow-[0px_-10px_20px_0px_rgba(0,0,0,0.3)]"
        style={{ maxWidth: "430px", margin: "0 auto" }}
      >
        <div className="px-4 py-4 flex gap-3">
          {/* Calendar Icon Button */}
          <button
            onClick={handleMyBookings}
            className="w-12 h-12 rounded-[9px] bg-surface-hover flex items-center justify-center transition-opacity active:opacity-70"
          >
            <Calendar className="w-6 h-6 text-muted-foreground" />
          </button>

          {/* Main Booking Button */}
          <button
            onClick={handleBooking}
            className="flex-1 h-12 rounded-[28px] bg-brand text-white text-lg font-medium transition-opacity active:opacity-80"
          >
            Записаться
          </button>
        </div>
        <BottomSafeArea />
      </div>
    </div>
  );
}
