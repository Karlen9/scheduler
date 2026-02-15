"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Settings, Clock } from "lucide-react";
import { getAvatarColor } from "@/lib/colors";
import { getPhotoUrl } from "@/lib/api";
import { formatDuration } from "@/components/DurationSelector";
import { useAdminProfile, useAdminBookings, useClients, useAdminServices } from "@/hooks/queries";
import { Booking } from "@/lib/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [photoError, setPhotoError] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const { data: trainer, isLoading: trainerLoading } = useAdminProfile();
  const { data: bookings, isLoading: bookingsLoading } = useAdminBookings();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: services, isLoading: servicesLoading } = useAdminServices();

  const isLoading = trainerLoading || bookingsLoading || clientsLoading || servicesLoading;

  const pendingCount = useMemo(() => {
    return bookings.filter(
      (b: Booking) => b.status === "pending" && b.createdBy !== "trainer"
    ).length;
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-6">
        <div className="bg-card rounded-xl p-4 animate-pulse">
          <div className="flex gap-4 mb-4">
            <div className="w-[127px] h-[127px] rounded-full bg-border flex-shrink-0" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-6 bg-border rounded w-3/4" />
              <div className="h-4 bg-border rounded w-1/2" />
              <div className="h-3 bg-border rounded w-full" />
              <div className="h-3 bg-border rounded w-2/3" />
            </div>
          </div>
          <div className="bg-background rounded-xl p-4 mb-4 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-6 bg-border rounded w-8 mx-auto" />
                <div className="h-3 bg-border rounded w-16 mx-auto" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-12 bg-border rounded-[28px]" />
            <div className="flex-1 h-12 bg-border rounded-[28px]" />
            <div className="w-12 h-12 bg-border rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-5 bg-card rounded w-24" />
          <div className="h-16 bg-card rounded-xl" />
        </div>
      </div>
    );
  }

  const name = trainer?.name || "Тренер";

  return (
    <div className="px-4 pt-4 space-y-6 pb-4">
      {/* Profile Card */}
      <div className="bg-card rounded-xl p-4">
        {/* Header: photo + info */}
        <div className="flex gap-4 mb-4">
          <div className="relative w-[127px] h-[127px] rounded-full overflow-hidden flex-shrink-0 bg-border">
            {trainer?.photoUrl && !photoError ? (
              <img
                src={getPhotoUrl(trainer.photoUrl)}
                alt={name}
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-4xl ${getAvatarColor(name)}`}>
                {name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">
              {name}
            </h2>
            {trainer?.specialization && (
              <p className="text-sm font-medium text-foreground mb-3 leading-snug">
                {trainer.specialization}
              </p>
            )}

            {(trainer?.phone || trainer?.telegramHandle) && (
              <div className="space-y-1.5">
                {trainer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{trainer.phone}</p>
                  </div>
                )}
                {trainer.telegramHandle && (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{trainer.telegramHandle}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="bg-background rounded-xl p-4 mb-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Новых заявок</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{clients.length}</p>
            <p className="text-xs text-muted-foreground">Клиентов</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{services.length}</p>
            <p className="text-xs text-muted-foreground">Услуг</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin/bookings")}
            className="flex-1 py-3 px-4 rounded-[28px] bg-brand text-white text-sm font-medium transition-opacity active:opacity-80"
          >
            Расписание
          </button>
          <button
            onClick={() => router.push("/admin/settings/services")}
            className="flex-1 py-3 px-4 rounded-[28px] bg-surface-hover border border-surface-border text-muted-foreground text-sm font-medium transition-opacity active:opacity-80"
          >
            Услуги и цены
          </button>
          <button
            onClick={() => router.push("/admin/settings")}
            className="w-12 h-12 rounded-full bg-surface-hover border border-surface-border flex items-center justify-center transition-opacity active:opacity-80"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

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
