"use client";

import { Calendar, Clock, MapPin, Video } from "lucide-react";

interface BookingCardProps {
  id: string;
  date: string;
  time: string;
  sessionType: string;
  location: string;
  status: "confirmed" | "cancelled";
  onReschedule?: () => void;
  onCancel?: () => void;
}

export function BookingCard({
  date,
  time,
  sessionType,
  location,
  status,
  onReschedule,
  onCancel,
}: BookingCardProps) {
  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{date}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{time}</span>
          </div>
          <div className="flex items-center gap-2">
            {location === "Онлайн" ? (
              <Video className="w-4 h-4 text-muted-foreground" />
            ) : (
              <MapPin className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground">{location}</span>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === "confirmed"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {status === "confirmed" ? "Подтверждено" : "Отменено"}
        </span>
      </div>

      <div className="pt-3 border-t border-border">
        <p className="text-sm font-medium text-foreground mb-3">
          {sessionType}
        </p>
        {status === "confirmed" && (
          <div className="flex gap-2">
            <button
              onClick={onReschedule}
              className="flex-1 py-2 px-4 rounded-lg bg-background text-foreground text-sm font-medium transition-opacity active:opacity-70"
            >
              Перенести
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
            >
              Отменить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
