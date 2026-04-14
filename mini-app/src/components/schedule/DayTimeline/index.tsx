'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { memo, useCallback, useMemo } from 'react';

import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { TimelineBookingCard } from './TimelineBookingCard';
import { TimelineEmptySlot } from './TimelineEmptySlot';

import type { TDayTimelineProps, TEmptySlot } from '@/lib/types';
import type { ReactNode } from 'react';

const HOUR_HEIGHT = 72;
const COLLAPSED_HEIGHT = HOUR_HEIGHT * 2;
const COLLAPSE_THRESHOLD_MIN = 120; // 2 hours

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

function formatMinuteTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Maps a time-in-minutes to a pixel offset, accounting for collapsed empty slots.
 * Normal regions: 1 hour = HOUR_HEIGHT pixels.
 * Collapsed regions: entire slot = COLLAPSED_HEIGHT pixels.
 */
function minuteToPixel(minute: number, minHourMin: number, collapsedSlots: TEmptySlot[]): number {
  let pixel = 0;
  let cursor = minHourMin;

  for (const slot of collapsedSlots) {
    if (minute <= cursor) {
      break;
    }
    if (slot.startMin <= cursor) {
      const segEnd = Math.min(minute, slot.endMin);
      if (segEnd > cursor) {
        const frac = (segEnd - cursor) / (slot.endMin - Math.max(slot.startMin, cursor));
        pixel += frac * COLLAPSED_HEIGHT;
        cursor = segEnd;
      }
      continue;
    }
    const normalEnd = Math.min(minute, slot.startMin);
    pixel += ((normalEnd - cursor) / 60) * HOUR_HEIGHT;
    cursor = normalEnd;
    if (minute <= slot.startMin) {
      break;
    }
    const collEnd = Math.min(minute, slot.endMin);
    const frac = (collEnd - slot.startMin) / (slot.endMin - slot.startMin);
    pixel += frac * COLLAPSED_HEIGHT;
    cursor = collEnd;
  }

  // Remaining normal segment
  if (minute > cursor) {
    pixel += ((minute - cursor) / 60) * HOUR_HEIGHT;
  }

  return pixel;
}

function DayTimelineComponent({
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

  const dayWH = useMemo(() => {
    if (!workingHours) {
      return [];
    }
    const dow = date.getDay();
    return [...workingHours]
      .filter((wh) => wh.dayOfWeek === dow)
      .sort((a, b) => parseTimeToMin(a.startTime) - parseTimeToMin(b.startTime));
  }, [workingHours, date]);

  const emptySlots = useMemo<TEmptySlot[]>(() => {
    if (dayWH.length === 0) {
      return [];
    }
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
    for (const interval of dayWH) {
      const whStart = parseTimeToMin(interval.startTime);
      const whEnd = parseTimeToMin(interval.endTime);
      let cursor = whStart;
      for (const slot of occupied) {
        if (slot.end <= whStart || slot.start >= whEnd) {
          continue;
        }
        const slotStart = Math.max(slot.start, whStart);
        const slotEnd = Math.min(slot.end, whEnd);
        if (cursor < slotStart) {
          gaps.push({ startMin: cursor, endMin: slotStart, kind: 'available' });
        }
        cursor = Math.max(cursor, slotEnd);
      }
      if (cursor < whEnd) {
        gaps.push({ startMin: cursor, endMin: whEnd, kind: 'available' });
      }
    }
    return gaps;
  }, [bookings, dayWH]);

  const breakSlots = useMemo<TEmptySlot[]>(() => {
    const slots: TEmptySlot[] = [];
    for (let i = 0; i < dayWH.length - 1; i++) {
      const currentEnd = parseTimeToMin(dayWH[i].endTime);
      const nextStart = parseTimeToMin(dayWH[i + 1].startTime);
      if (currentEnd < nextStart) {
        slots.push({ startMin: currentEnd, endMin: nextStart, kind: 'break' });
      }
    }
    return slots;
  }, [dayWH]);

  const timelineSlots = useMemo(
    () => [...emptySlots, ...breakSlots].sort((a, b) => a.startMin - b.startMin),
    [emptySlots, breakSlots],
  );

  // Sorted capped slots for the mapping function.
  const sortedCollapsed = useMemo(
    () =>
      timelineSlots
        .filter((s) => s.endMin - s.startMin > COLLAPSE_THRESHOLD_MIN)
        .sort((a, b) => a.startMin - b.startMin),
    [timelineSlots],
  );

  const { minHour, maxHour } = useMemo(() => {
    let min = 23;
    let max = 0;
    if (dayWH.length > 0) {
      min = Math.floor(Math.min(...dayWH.map((wh) => parseTimeToMin(wh.startTime))) / 60);
      max = Math.ceil(Math.max(...dayWH.map((wh) => parseTimeToMin(wh.endTime))) / 60);
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

  const toPixel = useCallback(
    (minute: number) => minuteToPixel(minute, minHour * 60, sortedCollapsed),
    [minHour, sortedCollapsed],
  );

  // No working hours and no bookings
  if (bookings.length === 0 && dayWH.length === 0) {
    return (
      <div className={'text-muted-foreground py-12 text-center text-sm'}>{t('noBookings')}</div>
    );
  }

  // No bookings but is a working day
  if (bookings.length === 0 && dayWH.length > 0) {
    return (
      <div className={'space-y-2'}>
        {timelineSlots.map((slot) =>
          slot.kind === 'break' ? (
            <div
              key={`break-${slot.startMin}`}
              className={
                'border-border bg-muted/40 relative w-full overflow-hidden rounded-xl border border-dashed p-4'
              }
            >
              <div
                className={'pointer-events-none absolute inset-0'}
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(-45deg, rgba(239, 68, 68, 0.14) 0 8px, transparent 8px 16px)',
                }}
              />
              <div className={'relative'}>
                <p className={'text-muted-foreground text-sm font-medium'}>{t('breakSlot')}</p>
                <p className={'text-muted-foreground mt-1 text-xs'}>
                  {formatMinuteTime(slot.startMin)}
                  {' – '}
                  {formatMinuteTime(slot.endMin)}
                </p>
              </div>
            </div>
          ) : (
            <button
              key={`empty-${slot.startMin}`}
              onClick={() => onEmptySlotClick?.(date, formatMinuteTime(slot.startMin))}
              className={
                'border-border w-full rounded-xl border border-dashed p-4 text-left transition-opacity active:opacity-80'
              }
            >
              <div className={'flex items-center justify-between'}>
                <div>
                  <p className={'text-muted-foreground text-sm font-medium'}>{t('emptySlot')}</p>
                  <p className={'text-muted-foreground/60 text-xs'}>{t('timeNotOccupied')}</p>
                  <p className={'text-muted-foreground mt-1 text-xs'}>
                    {formatMinuteTime(slot.startMin)}
                    {' – '}
                    {formatMinuteTime(slot.endMin)}
                  </p>
                </div>
                <div
                  className={'bg-brand/10 flex h-8 w-8 items-center justify-center rounded-full'}
                >
                  <Plus className={'text-brand h-4 w-4'} />
                </div>
              </div>
            </button>
          ),
        )}
      </div>
    );
  }

  // Build hour labels, skipping those inside collapsed regions
  const hourLabels: number[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    const hMin = h * 60;
    const insideCollapsed = sortedCollapsed.some((s) => hMin > s.startMin && hMin < s.endMin);
    if (!insideCollapsed) {
      hourLabels.push(h);
    }
  }

  const compressedHourLabels = sortedCollapsed.flatMap((slot) => {
    const labels: number[] = [];
    const startHour = Math.floor(slot.startMin / 60) + 1;
    const endHour = Math.ceil(slot.endMin / 60) - 1;
    for (let h = startHour; h <= endHour; h++) {
      const hMin = h * 60;
      if (hMin > slot.startMin && hMin < slot.endMin) {
        labels.push(h);
      }
    }
    return labels;
  });

  const totalHeight = toPixel(maxHour * 60);

  // Current time indicator
  let nowTop: number | null = null;
  if (isToday) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= minHour * 60 && nowMinutes <= maxHour * 60) {
      nowTop = toPixel(nowMinutes);
    }
  }

  return (
    <div className={'relative mt-10'} style={{ height: totalHeight + 16 }}>
      {/* Hour labels (no lines) */}
      {hourLabels.map((hour) => (
        <div
          key={hour}
          className={'absolute right-0 left-0 flex items-center'}
          style={{ top: toPixel(hour * 60) }}
        >
          <span
            className={
              'text-muted-foreground w-12 shrink-0 -translate-y-1/2 pr-2 text-right text-xs'
            }
          >
            {formatHour(hour)}
          </span>
        </div>
      ))}

      {compressedHourLabels.map((hour) => (
        <div
          key={`compressed-${hour}`}
          className={'absolute left-0 flex w-12 -translate-y-1/2 items-center justify-end pr-2'}
          style={{ top: toPixel(hour * 60) }}
        >
          <span className={'text-muted-foreground/50 text-[10px] leading-none'}>
            {formatHour(hour)}
          </span>
        </div>
      ))}

      {/* Empty slot cards */}
      {timelineSlots.map((slot) => {
        const slotTop = toPixel(slot.startMin);
        const slotBottom = toPixel(slot.endMin);
        const slotHeight = slotBottom - slotTop;
        const isCollapsed = slot.endMin - slot.startMin > COLLAPSE_THRESHOLD_MIN;

        return (
          <TimelineEmptySlot
            key={`${slot.kind ?? 'empty'}-${slot.startMin}`}
            slot={slot}
            date={date}
            top={slotTop}
            height={slotHeight}
            collapsed={isCollapsed}
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
        const bTop = toPixel(startMin);
        const bBottom = toPixel(endMin);
        const bHeight = bBottom - bTop;

        return (
          <TimelineBookingCard
            key={booking.id}
            booking={booking}
            top={bTop}
            height={bHeight}
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

export const DayTimeline = memo(DayTimelineComponent);
