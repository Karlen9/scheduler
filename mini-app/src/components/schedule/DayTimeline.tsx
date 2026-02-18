'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Booking, WorkingHours } from '@/lib/types';
import { ClientAvatar } from '@/components/ClientAvatar';

interface DayTimelineProps {
  bookings: Booking[];
  date: Date;
  onBookingClick?: (booking: Booking) => void;
  workingHours?: WorkingHours[];
  onEmptySlotClick?: (date: Date, time: string) => void;
}

interface EmptySlot {
  startMin: number;
  endMin: number;
}

const HOUR_HEIGHT = 72;

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getCardStyle(status: string): { bg: string; text: string; subtext: string } {
  switch (status) {
    case 'confirmed':
      return { bg: 'bg-brand', text: 'text-white', subtext: 'text-white/70' };
    case 'pending':
      return { bg: 'bg-warning', text: 'text-white', subtext: 'text-white/80' };
    default:
      return { bg: 'bg-brand', text: 'text-white', subtext: 'text-white/70' };
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseTimeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function DayTimeline({
  bookings,
  date,
  onBookingClick,
  workingHours,
  onEmptySlotClick,
}: DayTimelineProps) {
  const t = useTranslations('DayTimeline');
  const tc = useTranslations('Common');
  const locale = useLocale();

  const today = useMemo(() => new Date(), []);
  const isToday = isSameDay(date, today);

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  // Get working hours for this day of week
  const dayWH = useMemo(() => {
    if (!workingHours) return null;
    const dow = date.getDay(); // 0=Sun
    return workingHours.find((wh) => wh.dayOfWeek === dow) ?? null;
  }, [workingHours, date]);

  // Calculate empty slots (gaps between bookings within working hours)
  const emptySlots = useMemo<EmptySlot[]>(() => {
    if (!dayWH) return [];
    const whStart = parseTimeToMin(dayWH.startTime);
    const whEnd = parseTimeToMin(dayWH.endTime);

    if (bookings.length === 0) {
      return [{ startMin: whStart, endMin: whEnd }];
    }

    // Get sorted occupied ranges
    const occupied = bookings
      .map((b) => {
        const s = new Date(b.startsAt);
        const e = new Date(b.endsAt);
        return {
          start: s.getUTCHours() * 60 + s.getUTCMinutes(),
          end: e.getUTCHours() * 60 + e.getUTCMinutes(),
        };
      })
      .sort((a, b) => a.start - b.start);

    const gaps: EmptySlot[] = [];
    let cursor = whStart;

    for (const slot of occupied) {
      const slotStart = Math.max(slot.start, whStart);
      const slotEnd = Math.min(slot.end, whEnd);
      if (cursor < slotStart) {
        gaps.push({ startMin: cursor, endMin: slotStart });
      }
      cursor = Math.max(cursor, slotEnd);
    }

    if (cursor < whEnd) {
      gaps.push({ startMin: cursor, endMin: whEnd });
    }

    return gaps;
  }, [bookings, dayWH]);

  // Determine hour range -- extend to working hours if available
  const { minHour, maxHour } = useMemo(() => {
    let min = 23;
    let max = 0;

    if (dayWH) {
      min = Math.floor(parseTimeToMin(dayWH.startTime) / 60);
      max = Math.ceil(parseTimeToMin(dayWH.endTime) / 60);
    }

    for (const b of bookings) {
      const start = new Date(b.startsAt);
      const end = new Date(b.endsAt);
      min = Math.min(min, start.getUTCHours());
      const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
      max = Math.max(max, endHour);
    }

    return { minHour: min, maxHour: max };
  }, [bookings, dayWH]);

  // No working hours and no bookings -- show simple empty
  if (bookings.length === 0 && !dayWH) {
    return <div className="text-muted-foreground py-12 text-center text-sm">{t('noBookings')}</div>;
  }

  // No bookings but is a working day -- show empty slot without timeline grid
  if (bookings.length === 0 && dayWH) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => onEmptySlotClick?.(date, dayWH.startTime)}
          className="border-border w-full rounded-xl border border-dashed p-4 text-left transition-opacity active:opacity-80"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">{t('emptySlot')}</p>
              <p className="text-muted-foreground/60 text-xs">{t('timeNotOccupied')}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {dayWH.startTime} – {dayWH.endTime}
              </p>
            </div>
            <div className="bg-brand/10 flex h-8 w-8 items-center justify-center rounded-full">
              <Plus className="text-brand h-4 w-4" />
            </div>
          </div>
        </button>
      </div>
    );
  }

  const hourLabels: number[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    hourLabels.push(h);
  }

  const totalHeight = (maxHour - minHour) * HOUR_HEIGHT;

  // Current time indicator
  let nowTop: number | null = null;
  if (isToday) {
    const now = new Date();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (nowMinutes >= minHour * 60 && nowMinutes <= maxHour * 60) {
      nowTop = ((nowMinutes - minHour * 60) / 60) * HOUR_HEIGHT;
    }
  }

  return (
    <div className="relative" style={{ height: totalHeight + 16 }}>
      {/* Hour grid lines and labels */}
      {hourLabels.map((hour) => (
        <div
          key={hour}
          className="absolute right-0 left-0 flex items-center"
          style={{ top: (hour - minHour) * HOUR_HEIGHT }}
        >
          <span className="text-muted-foreground w-12 shrink-0 -translate-y-1/2 pr-2 text-right text-xs">
            {formatHour(hour)}
          </span>
          <div className="border-border flex-1 border-t" />
        </div>
      ))}

      {/* Empty slot cards */}
      {emptySlots.map((slot) => {
        const top = ((slot.startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        const height = ((slot.endMin - slot.startMin) / 60) * HOUR_HEIGHT;

        return (
          <button
            key={`empty-${slot.startMin}`}
            onClick={() => onEmptySlotClick?.(date, formatMinutes(slot.startMin))}
            className="bg-card border-surface-border absolute right-0 left-12 overflow-hidden rounded-xl border border-dashed px-3 py-2 text-left transition-opacity active:opacity-80"
            style={{ top: top + 3, height: height - 3 }}
          >
            <div className="flex h-full items-center justify-between">
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm font-medium">{t('emptySlot')}</p>
                {height >= 54 && (
                  <p className="text-muted-foreground/60 text-xs">{t('timeNotOccupied')}</p>
                )}
                {height >= 68 && (
                  <p className="text-muted-foreground/60 text-xs">
                    {formatMinutes(slot.startMin)} – {formatMinutes(slot.endMin)}
                  </p>
                )}
              </div>
              <div className="bg-brand/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <Plus className="text-brand h-3.5 w-3.5" />
              </div>
            </div>
          </button>
        );
      })}

      {/* Booking cards */}
      {bookings.map((booking) => {
        const start = new Date(booking.startsAt);
        const end = new Date(booking.endsAt);
        const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
        const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
        const top = ((startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
        const style = getCardStyle(booking.status);

        return (
          <button
            key={booking.id}
            onClick={() => onBookingClick?.(booking)}
            className={`absolute right-0 left-12 ${style.bg} overflow-hidden rounded-xl px-3 py-2 text-left transition-opacity active:opacity-80`}
            style={{ top: top + 3, height: height - 3 }}
          >
            <div className="flex h-full items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${style.text} truncate`}>{booking.clientName}</p>
                {height >= 54 && (
                  <p className={`text-xs ${style.subtext} truncate`}>
                    {tc('workout')}
                    {booking.durationMinutes
                      ? ` \u00b7 ${booking.durationMinutes} ${tc('min')}`
                      : ''}
                  </p>
                )}
                {height >= 68 && (
                  <p className={`text-xs ${style.subtext}`}>
                    {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
                  </p>
                )}
              </div>
              <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="sm" />
            </div>
          </button>
        );
      })}

      {/* Current time indicator */}
      {nowTop !== null && (
        <div
          className="pointer-events-none absolute right-0 left-10 z-10 flex items-center"
          style={{ top: nowTop }}
        >
          <div className="bg-destructive -ml-1 h-2.5 w-2.5 rounded-full" />
          <div className="border-destructive flex-1 border-t-2" />
        </div>
      )}
    </div>
  );
}
