"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Dumbbell, Users } from "lucide-react";
import { WaitlistEntry } from "@/lib/types";

interface WaitlistCardProps {
  entry: WaitlistEntry;
  onAccept?: (entry: WaitlistEntry) => void;
  onDecline?: (entry: WaitlistEntry) => void;
  onLeave?: (entry: WaitlistEntry) => void;
}

function formatDate(date: Date): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function CountdownTimer({ offeredAt }: { offeredAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const expiry = new Date(offeredAt).getTime() + 30 * 60 * 1000;
      const diff = expiry - Date.now();
      if (diff <= 0) {
        setRemaining("Время истекло");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [offeredAt]);

  return <span className="text-yellow-400 text-xs font-medium">{remaining}</span>;
}

export function WaitlistCard({ entry, onAccept, onDecline, onLeave }: WaitlistCardProps) {
  const startsAt = new Date(entry.startsAt);
  const endsAt = new Date(entry.endsAt);
  const isOffered = entry.status === "offered";
  const isWaiting = entry.status === "waiting";

  return (
    <div className={`bg-card rounded-xl p-4 ${isOffered ? "ring-1 ring-yellow-700/50" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{formatDate(startsAt)}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {formatTime(startsAt)} – {formatTime(endsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              Тренировка
              <span className="text-muted-foreground"> · {entry.durationMinutes} мин</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isOffered ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400">
              Место свободно!
            </span>
          ) : (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400">
              <Users className="w-3 h-3" />
              <span>#{entry.position || "–"} в очереди</span>
            </div>
          )}
          {isOffered && entry.offeredAt && (
            <CountdownTimer offeredAt={entry.offeredAt} />
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        {isOffered && (
          <div className="flex gap-2">
            <button
              onClick={() => onAccept?.(entry)}
              className="flex-1 py-2 px-4 rounded-lg bg-green-900/30 text-green-400 text-sm font-medium transition-opacity active:opacity-70"
            >
              Забронировать
            </button>
            <button
              onClick={() => onDecline?.(entry)}
              className="flex-1 py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
            >
              Отказаться
            </button>
          </div>
        )}
        {isWaiting && (
          <button
            onClick={() => onLeave?.(entry)}
            className="w-full py-2 px-4 rounded-lg bg-background text-muted-foreground text-sm font-medium transition-opacity active:opacity-70"
          >
            Покинуть очередь
          </button>
        )}
      </div>
    </div>
  );
}
