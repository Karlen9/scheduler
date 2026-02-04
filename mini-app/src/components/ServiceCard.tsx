"use client";

import { Pencil } from "lucide-react";
import { SessionType } from "@/lib/types";

interface ServiceCardProps {
  service: SessionType;
  onEdit?: () => void;
}

export function ServiceCard({ service, onEdit }: ServiceCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 flex items-center gap-4 shadow-sm">
      <div className="flex-1">
        <h4 className="font-medium text-[var(--app-text)]">{service.name}</h4>
        <p className="text-sm text-[var(--app-subtext)]">
          Цена: {service.price.toLocaleString()} {service.currency === "RUB" ? "₽" : service.currency}
        </p>
        <p className="text-sm text-[var(--app-subtext)]">
          Длительность: {service.durationMinutes} минут
        </p>
      </div>
      <button
        onClick={onEdit}
        className="w-10 h-10 rounded-full bg-[#5984d8] flex items-center justify-center transition-opacity active:opacity-80"
      >
        <Pencil className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}
