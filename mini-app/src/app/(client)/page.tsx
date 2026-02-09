"use client";

import { useEffect, useState } from "react";
import { TrainerCard } from "@/components/TrainerCard";
import { api } from "@/lib/api";
import { Trainer } from "@/lib/types";

export default function HomePage() {
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getTrainer()
      .then(setTrainer)
      .catch((err) => console.error("Failed to load trainer:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleServices = () => {
    console.log("Opening services...");
  };

  const handleShare = () => {
    console.log("Sharing profile...");
  };

  return (
    <div className="px-4 pt-4 space-y-6">
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
          botUsername={trainer.botUsername}
          onServices={handleServices}
          onShare={handleShare}
        />
      ) : (
        <div className="bg-card rounded-xl p-4 text-center text-muted-foreground">
          Не удалось загрузить информацию о тренере
        </div>
      )}

      {trainer?.gymLatitude && trainer?.gymLongitude ? (
        <a
          href={`https://yandex.ru/maps/?pt=${trainer.gymLongitude},${trainer.gymLatitude}&z=15&l=map`}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-card rounded-xl overflow-hidden"
        >
          <iframe
            src={`https://yandex.ru/map-widget/v1/?ll=${trainer.gymLongitude},${trainer.gymLatitude}&z=15&pt=${trainer.gymLongitude},${trainer.gymLatitude},pm2rdm`}
            width="100%"
            height="200"
            style={{ border: "none", display: "block", pointerEvents: "none" }}
            allowFullScreen
          />
        </a>
      ) : null}
    </div>
  );
}
