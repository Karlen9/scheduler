"use client";

import { Clock, Dumbbell } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { SessionType } from "@/lib/types";
import { formatDuration } from "@/components/DurationSelector";
import { getPhotoUrl } from "@/lib/api";
import { useSessionTypes } from "@/hooks/queries";

export default function ServicesPage() {
  const { data: services, isLoading: loading } = useSessionTypes();

  if (loading) {
    return (
      <div>
        <TopBar title="Услуги и цены" showBack />
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-border flex-shrink-0" />
              <div className="flex-1">
                <div className="h-5 bg-border rounded w-2/3 mb-2" />
                <div className="h-4 bg-border rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Услуги и цены" showBack />

      <div className="p-4 space-y-3">
        {services.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Нет доступных услуг
          </div>
        ) : (
          services.map((service: SessionType) => (
            <div
              key={service.id}
              className="bg-card rounded-xl p-4 flex items-center gap-3"
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
                <h3 className="text-base font-medium text-foreground mb-1">
                  {service.name}
                </h3>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(service.durationMinutes)}
                  </span>
                </div>
              </div>
              <span className="text-base font-semibold text-foreground flex-shrink-0">
                {service.price.toLocaleString("ru-RU")} {service.currency === "RUB" ? "\u20BD" : service.currency}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
