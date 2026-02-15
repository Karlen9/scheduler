"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { TrainerCard } from "@/components/TrainerCard";
import { formatDuration } from "@/components/DurationSelector";
import { useTrainer, useSessionTypes } from "@/hooks/queries";

export default function HomePage() {
  const router = useRouter();
  const { data: trainer, isLoading: trainerLoading } = useTrainer();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const [bioExpanded, setBioExpanded] = useState(false);

  const isLoading = trainerLoading || servicesLoading;

  const handleServices = () => {
    router.push("/services");
  };

  const handleShare = () => {
    const url = `https://t.me/${trainer?.botUsername}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webApp = window.Telegram?.WebApp as any;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(trainer?.name || "")}`
      );
    } else if (navigator.share) {
      navigator.share({ title: trainer?.name, url });
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-6">
        <div className="bg-card rounded-xl p-4 animate-pulse">
          <div className="flex gap-4 mb-4">
            <div className="w-[127px] h-[127px] rounded-full bg-border" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-6 bg-border rounded w-3/4" />
              <div className="h-4 bg-border rounded w-1/2" />
              <div className="h-3 bg-border rounded w-full" />
              <div className="h-3 bg-border rounded w-2/3" />
            </div>
          </div>
          <div className="bg-background rounded-xl p-4 mb-4">
            <div className="h-6 bg-border rounded w-8 mx-auto" />
            <div className="h-3 bg-border rounded w-16 mx-auto mt-2" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-12 bg-border rounded-[28px]" />
            <div className="flex-1 h-12 bg-border rounded-[28px]" />
            <div className="w-12 h-12 bg-border rounded-[28px]" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-5 bg-card rounded w-24" />
          <div className="h-16 bg-card rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-6 pb-4">
      {trainer ? (
        <TrainerCard
          name={trainer.name}
          specialization={trainer.specialization || ""}
          photoUrl={trainer.photoUrl}
          phone={trainer.phone}
          telegram={trainer.telegramHandle}
          botUsername={trainer.botUsername}
          servicesCount={services.length}
          onServices={handleServices}
          onShare={handleShare}
        />
      ) : (
        <div className="bg-card rounded-xl p-4 text-center text-muted-foreground">
          Не удалось загрузить информацию о тренере
        </div>
      )}

      {/* Bio Section */}
      {trainer?.bio && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Описание:</h3>
          <div className="bg-card rounded-xl p-4">
            <p
              className={`text-sm text-muted-foreground leading-relaxed ${
                !bioExpanded ? "line-clamp-4" : ""
              }`}
            >
              {trainer.bio}
            </p>
            {trainer.bio.length > 200 && (
              <button
                onClick={() => setBioExpanded(!bioExpanded)}
                className="text-sm text-brand mt-2 font-medium"
              >
                {bioExpanded ? "Скрыть" : "Показать больше"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Services Section */}
      {services.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Услуги:</h3>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-card rounded-xl p-4 flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{service.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(service.durationMinutes)}
                    </p>
                  </div>
                </div>
                {service.price > 0 && (
                  <p className="text-sm font-semibold text-foreground ml-4">
                    {service.price} {service.currency || "₽"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Location Section */}
      {trainer?.gymLatitude && trainer?.gymLongitude && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2">Локация:</h3>
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
        </section>
      )}
    </div>
  );
}
