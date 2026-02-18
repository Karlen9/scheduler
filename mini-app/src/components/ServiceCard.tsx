"use client";

import { Pencil } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { SessionType } from "@/lib/types";

interface ServiceCardProps {
  service: SessionType;
  onEdit?: () => void;
}

export function ServiceCard({ service, onEdit }: ServiceCardProps) {
  const t = useTranslations("ServiceCard");
  const locale = useLocale();

  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1">
        <h4 className="font-medium text-foreground">{service.name}</h4>
        <p className="text-sm text-muted-foreground">
          {t("priceLabel")} {service.price.toLocaleString(locale === "en" ? "en-US" : "ru-RU")} {service.currency === "RUB" ? "\u20BD" : service.currency}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("durationLabel")} {service.durationMinutes} {t("minutes")}
        </p>
      </div>
      <button
        onClick={onEdit}
        className="w-10 h-10 rounded-full bg-brand flex items-center justify-center transition-opacity active:opacity-80"
      >
        <Pencil className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}
