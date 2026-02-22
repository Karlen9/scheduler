'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { TimelineBookingCard } from './TimelineBookingCard';
import { TimelineEmptySlot } from './TimelineEmptySlot';

import type { TEmptySlot } from './TimelineEmptySlot';
import type { TBooking, TWorkingHours } from '@/lib/types';
import type { ReactNode } from 'react';

type TDayTimelineProps = {
  bookings: TBooking[];
  date: Date;
  onBookingClick?: (booking: TBooking) => void;
  workingHours?: TWorkingHours[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

const HOUR_HEIGHT = 72;

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
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
}: TDayTimelineProps): ReactNode {
  const t = useTranslations('DayTimeline');
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
    if (!workingHours) {
      return null;
    }
    const dow = date.getDay(); // 0=Sun
    return workingHours.find((wh) => wh.dayOfWeek === dow) ?? null;
  }, [workingHours, date]);

  // Calculate empty slots (gaps between bookings within working hours)
  const emptySlots = useMemo<TEmptySlot[]>(() => {
    if (!dayWH) {
      return [];
    }
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

    const gaps: TEmptySlot[] = [];
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
    return (
      <div className={'text-muted-foreground py-12 text-center text-sm'}>{t('noBookings')}</div>
    );
  }

  // No bookings but is a working day -- show empty slot without timeline grid
  if (bookings.length === 0 && dayWH) {
    return (
      <div className={'space-y-2'}>
        <button
          onClick={() => onEmptySlotClick?.(date, dayWH.startTime)}
          className={
            'border-border w-full rounded-xl border border-dashed p-4 text-left transition-opacity active:opacity-80'
          }
        >
          <div className={'flex items-center justify-between'}>
            <div>
              <p className={'text-muted-foreground text-sm font-medium'}>{t('emptySlot')}</p>
              <p className={'text-muted-foreground/60 text-xs'}>{t('timeNotOccupied')}</p>
              <p className={'text-muted-foreground mt-1 text-xs'}>
                {dayWH.startTime}
                {' – '}
                {dayWH.endTime}
              </p>
            </div>
            <div className={'bg-brand/10 flex h-8 w-8 items-center justify-center rounded-full'}>
              <Plus className={'text-brand h-4 w-4'} />
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
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= minHour * 60 && nowMinutes <= maxHour * 60) {
      nowTop = ((nowMinutes - minHour * 60) / 60) * HOUR_HEIGHT;
    }
  }

  return (
    <div className={'relative'} style={{ height: totalHeight + 16 }}>
      {/* Hour grid lines and labels */}
      {hourLabels.map((hour) => (
        <div
          key={hour}
          className={'absolute right-0 left-0 flex items-center'}
          style={{ top: (hour - minHour) * HOUR_HEIGHT }}
        >
          <span
            className={
              'text-muted-foreground w-12 shrink-0 -translate-y-1/2 pr-2 text-right text-xs'
            }
          >
            {formatHour(hour)}
          </span>
          <div className={'border-border flex-1 border-t'} />
        </div>
      ))}

      {/* Empty slot cards */}
      {emptySlots.map((slot) => {
        const top = ((slot.startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        const height = ((slot.endMin - slot.startMin) / 60) * HOUR_HEIGHT;

        return (
          <TimelineEmptySlot
            key={`empty-${slot.startMin}`}
            slot={slot}
            date={date}
            top={top}
            height={height}
            onEmptySlotClick={onEmptySlotClick}
          />
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

        return (
          <TimelineBookingCard
            key={booking.id}
            booking={booking}
            top={top}
            height={height}
            onBookingClick={onBookingClick}
            formatTime={formatTime}
          />
        );
      })}

      {/* Current time indicator */}
      {nowTop !== null && <CurrentTimeIndicator top={nowTop} />}
    </div>
  );
}
