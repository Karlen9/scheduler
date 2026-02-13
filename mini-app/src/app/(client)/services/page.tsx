"use client";

import { TopBar } from "@/components/TopBar";
import { SessionType } from "@/lib/types";
import { formatDuration } from "@/components/DurationSelector";
import { useSessionTypes } from "@/hooks/queries";

export default function ServicesPage() {
  const { data: services, isLoading: loading } = useSessionTypes();

  if (loading) {
    return (
      <div>
        <TopBar title="Услуги и цены" showBack />
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4">
              <div className="h-5 bg-border rounded w-2/3 mb-2" />
              <div className="h-4 bg-border rounded w-1/3 mb-1" />
              <div className="h-4 bg-border rounded w-1/4" />
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
              className="bg-card rounded-xl p-4"
            >
              <h3 className="text-base font-medium text-foreground mb-1">
                {service.name}
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {formatDuration(service.durationMinutes)}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {service.price.toLocaleString("ru-RU")} {service.currency === "RUB" ? "\u20BD" : service.currency}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
