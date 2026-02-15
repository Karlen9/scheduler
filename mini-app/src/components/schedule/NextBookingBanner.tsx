"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

interface NextBookingBannerProps {
  booking: Booking | null;
  onBookingClick?: (booking: Booking) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function getTimeUntil(iso: string): string {
  const now = new Date();
  const start = new Date(iso);
  const diff = start.getTime() - now.getTime();
  if (diff <= 0) return "сейчас";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `через ${minutes} ${minuteWord(minutes)}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `через ${hours} ${hourWord(hours)}`;
  const days = Math.floor(hours / 24);
  return `через ${days} ${dayWord(days)}`;
}

function minuteWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "минуту";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "минуты";
  return "минут";
}

function hourWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "час";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "часа";
  return "часов";
}

function dayWord(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}

export function NextBookingBanner({ booking, onBookingClick }: NextBookingBannerProps) {
  const router = useRouter();

  if (!booking) {
    return (
      <div>
        <h2 className="text-base font-medium text-foreground mb-3">Ближайшая запись</h2>
        <div className="bg-card rounded-xl p-4 border-l-4 border-l-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-muted-foreground">Записей нет</p>
              <p className="text-sm text-muted-foreground/60 mt-0.5">Нет предстоящих тренировок</p>
            </div>
            <button
              onClick={() => router.push("/admin/book")}
              className="w-10 h-10 rounded-full bg-brand flex items-center justify-center transition-opacity active:opacity-80"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-medium text-foreground mb-3">Ближайшая запись</h2>
      <button
        onClick={() => onBookingClick?.(booking)}
        className="w-full bg-card rounded-xl p-4 border-l-4 border-l-brand text-left transition-opacity active:opacity-80"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{booking.clientName}</p>
            <p className="text-sm text-muted-foreground">
              Тренировка{booking.durationMinutes ? ` \u00b7 ${booking.durationMinutes} мин` : ""}
            </p>
            <p className="text-xs text-brand mt-1">{getTimeUntil(booking.startsAt)}</p>
            <p className="text-sm text-foreground mt-0.5">
              {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
            </p>
          </div>
          <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="lg" />
        </div>
      </button>
    </div>
  );
}
