"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Clock, Phone, MessageCircle, Share2, Dumbbell } from "lucide-react";
import { formatDuration } from "@/components/DurationSelector";
import { getPhotoUrl } from "@/lib/api";
import { getAvatarColor } from "@/lib/colors";
import { getTrainerId } from "@/lib/telegram";
import { useTrainer, useSessionTypes } from "@/hooks/queries";

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("HomePage");
  const td = useTranslations("Duration");
  const locale = useLocale();
  const { data: trainer, isLoading: trainerLoading } = useTrainer();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const [bioExpanded, setBioExpanded] = useState(false);
  const [heroError, setHeroError] = useState(false);

  // Redirect trainer to admin panel
  useEffect(() => {
    if (trainer?.isOwner) {
      const trainerId = getTrainerId();
      router.replace(`/admin${trainerId ? `?trainer=${trainerId}` : ""}`);
    }
  }, [trainer, router]);

  const isLoading = trainerLoading || servicesLoading;

  const handleMessage = () => {
    if (trainer?.telegramHandle) {
      const handle = trainer.telegramHandle.replace("@", "");
      window.open(`https://t.me/${handle}`, "_blank");
    } else if (trainer?.botUsername) {
      window.open(`https://t.me/${trainer.botUsername}`, "_blank");
    }
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
      <div className="animate-pulse">
        {/* Hero skeleton */}
        <div className="w-full h-[280px] bg-border" />
        {/* Card skeleton */}
        <div className="bg-card rounded-t-2xl -mt-6 relative px-4 pt-6 pb-4 space-y-4">
          <div className="h-7 bg-border rounded w-2/3" />
          <div className="h-4 bg-border rounded w-1/2" />
          <div className="h-3 bg-border rounded w-3/4" />
          <div className="flex gap-2 pt-2">
            <div className="flex-1 h-12 bg-border rounded-[28px]" />
            <div className="flex-1 h-12 bg-border rounded-[28px]" />
            <div className="w-12 h-12 bg-border rounded-[28px]" />
          </div>
          <div className="space-y-3 pt-4">
            <div className="h-5 bg-border rounded w-24" />
            <div className="h-16 bg-border rounded-xl" />
            <div className="h-16 bg-border rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="px-4 pt-4">
        <div className="bg-card rounded-xl p-4 text-center text-muted-foreground">
          {t("trainerLoadError")}
        </div>
      </div>
    );
  }

  const hasPhoto = trainer.photoUrl && !heroError;

  return (
    <div>
      {/* Hero Section */}
      <div className="relative w-full h-[280px] overflow-hidden">
        {hasPhoto ? (
          <>
            <img
              src={getPhotoUrl(trainer.photoUrl!)}
              alt={trainer.name}
              className="w-full h-full object-cover"
              onError={() => setHeroError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-7xl ${getAvatarColor(trainer.name)}`}>
            {trainer.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Trainer Info Card */}
      <div className="bg-card rounded-t-2xl -mt-6 relative z-10">
        <div className="px-4 pt-6 pb-4 space-y-4">
          {/* Name & specialization */}
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {trainer.name}
            </h1>
            {trainer.specialization && (
              <p className="text-sm text-muted-foreground mt-1">
                {trainer.specialization}
              </p>
            )}
          </div>

          {/* Contact row */}
          {(trainer.phone || trainer.telegramHandle) && (
            <div className="flex items-center gap-4">
              {trainer.phone && (
                <a href={`tel:${trainer.phone}`} className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="text-xs">{trainer.phone}</span>
                </a>
              )}
              {trainer.telegramHandle && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">{trainer.telegramHandle}</span>
                </div>
              )}
            </div>
          )}

          {/* Bio Section */}
          {trainer.bio && (
            <div>
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
                  className="text-sm text-brand mt-1 font-medium"
                >
                  {bioExpanded ? t("showLess") : t("showMore")}
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {(trainer.telegramHandle || trainer.botUsername) && (
              <button
                onClick={handleMessage}
                className="flex-1 py-3 px-4 rounded-[28px] bg-brand text-white text-sm font-medium transition-opacity active:opacity-80"
              >
                {t("messageButton")}
              </button>
            )}
            <button
              onClick={() => router.push("/services")}
              className="flex-1 py-3 px-4 rounded-[28px] bg-surface-hover border border-surface-border text-muted-foreground text-sm font-medium transition-opacity active:opacity-80"
            >
              {t("servicesButton")}
            </button>
            <button
              onClick={handleShare}
              className="w-12 h-12 rounded-[28px] bg-surface-hover border border-surface-border flex items-center justify-center transition-opacity active:opacity-80"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Services Section */}
        {services.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">{t("servicesTitle")}</h3>
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-background rounded-xl p-3 flex items-center gap-3"
                >
                  {/* Service thumbnail */}
                  <div className="w-10 h-10 rounded-full bg-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {service.imageUrl ? (
                      <img
                        src={getPhotoUrl(service.imageUrl)}
                        alt={service.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Dumbbell className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  {/* Service info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{service.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(service.durationMinutes, td("hour"))}
                      </p>
                    </div>
                  </div>
                  {service.price > 0 && (
                    <p className="text-sm font-semibold text-foreground ml-2 flex-shrink-0">
                      {service.price.toLocaleString(locale === "en" ? "en-US" : "ru-RU")} {service.currency === "RUB" ? "\u20BD" : service.currency}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Section */}
        {trainer.gymLatitude && trainer.gymLongitude && (
          <div className="px-4 pb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">{t("locationTitle")}</h3>
            <a
              href={`https://yandex.ru/maps/?pt=${trainer.gymLongitude},${trainer.gymLatitude}&z=15&l=map`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-background rounded-xl overflow-hidden"
            >
              <iframe
                src={`https://yandex.ru/map-widget/v1/?ll=${trainer.gymLongitude},${trainer.gymLatitude}&z=15&pt=${trainer.gymLongitude},${trainer.gymLatitude},pm2rdm`}
                width="100%"
                height="200"
                style={{ border: "none", display: "block", pointerEvents: "none" }}
                allowFullScreen
              />
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
