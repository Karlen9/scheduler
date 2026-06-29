'use client';

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

function roundUpToQuarterHour(minute: number): number {
  return Math.ceil(minute / 15) * 15;
}

function collapsedSlotOffset(minute: number, slot: TEmptySlot): number {
  const duration = slot.endMin - slot.startMin;
  if (duration <= 0) {
    return 0;
  }

  const headEnd = Math.min(slot.endMin, Math.ceil(slot.startMin / 60) * 60);
  const tailStart = Math.max(headEnd, Math.floor(slot.endMin / 60) * 60);
  const headHeight = ((headEnd - slot.startMin) / 60) * HOUR_HEIGHT;
  const tailHeight = ((slot.endMin - tailStart) / 60) * HOUR_HEIGHT;
  const middleDuration = tailStart - headEnd;
  const middleHeight = Math.max(0, COLLAPSED_HEIGHT - headHeight - tailHeight);

  if (headEnd === slot.startMin && tailStart === slot.endMin) {
    return ((minute - slot.startMin) / duration) * COLLAPSED_HEIGHT;
  }

  if (minute <= headEnd) {
    return ((minute - slot.startMin) / 60) * HOUR_HEIGHT;
  }

  if (minute >= tailStart) {
    return headHeight + middleHeight + ((minute - tailStart) / 60) * HOUR_HEIGHT;
  }

  if (middleDuration <= 0) {
    return headHeight;
  }

  return headHeight + ((minute - headEnd) / middleDuration) * middleHeight;
}

function isCompressedSlotMiddleMinute(minute: number, slot: TEmptySlot): boolean {
  if (minute <= slot.startMin || minute >= slot.endMin) {
    return false;
  }

  const headEnd = Math.min(slot.endMin, Math.ceil(slot.startMin / 60) * 60);
  const tailStart = Math.max(headEnd, Math.floor(slot.endMin / 60) * 60);
  if (headEnd === slot.startMin && tailStart === slot.endMin) {
    return true;
  }

  return minute > headEnd && minute < tailStart;
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
    if (minute <= slot.startMin) {
      pixel += ((minute - cursor) / 60) * HOUR_HEIGHT;
      return pixel;
    }

    if (slot.startMin > cursor) {
      pixel += ((slot.startMin - cursor) / 60) * HOUR_HEIGHT;
    }

    if (minute <= slot.endMin) {
      return pixel + collapsedSlotOffset(minute, slot);
    }

    pixel += COLLAPSED_HEIGHT;
    cursor = slot.endMin;
  }

  return pixel + ((minute - cursor) / 60) * HOUR_HEIGHT;
}

function DayTimelineComponent({
  bookings,
  date,
  onBookingClick,
  workingHours,
  serviceDurations,
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
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const minAvailableMinute = isToday ? roundUpToQuarterHour(nowMinutes) : 0;

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

    // Determine which intervals to scan for gaps.
    // When working hours are configured, use them directly.
    // When there are no working hours but there are bookings, synthesise a
    // single interval that spans the entire booking range so that the
    // gap-finding loop can still emit empty-slot cards between bookings.
    let intervals: { startTime: string; endTime: string }[];
    if (dayWH.length > 0) {
      intervals = dayWH;
    } else if (occupied.length > 0) {
      const spanStart = Math.min(...occupied.map((s) => s.start));
      const spanEnd = Math.max(...occupied.map((s) => s.end));
      const pad = (min: number): string =>
        `${Math.floor(min / 60)
          .toString()
          .padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;
      intervals = [{ startTime: pad(spanStart), endTime: pad(spanEnd) }];
    } else {
      return [];
    }

    const gaps: TEmptySlot[] = [];
    for (const interval of intervals) {
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
          const gapStart = isToday ? Math.max(cursor, minAvailableMinute) : cursor;
          if (gapStart < slotStart) {
            gaps.push({ startMin: gapStart, endMin: slotStart, kind: 'available' });
          }
        }
        cursor = Math.max(cursor, slotEnd);
      }
      if (cursor < whEnd) {
        const gapStart = isToday ? Math.max(cursor, minAvailableMinute) : cursor;
        if (gapStart < whEnd) {
          gaps.push({ startMin: gapStart, endMin: whEnd, kind: 'available' });
        }
      }
    }
    return gaps;
  }, [bookings, dayWH, isToday]);

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
    if (isToday) {
      min = Math.max(min, today.getHours());
    }
    return { minHour: min, maxHour: max };
  }, [bookings, dayWH, isToday, today]);

  const timelineStartMin = minHour * 60;
  const timelineEndMin = maxHour * 60;

  const visibleTimelineSlots = useMemo(
    () =>
      timelineSlots
        .map((slot) => ({
          ...slot,
          startMin: Math.max(slot.startMin, timelineStartMin),
          endMin: Math.min(slot.endMin, timelineEndMin),
        }))
        .filter((slot) => slot.startMin < slot.endMin),
    [timelineSlots, timelineEndMin, timelineStartMin],
  );

  const visibleBookings = useMemo(
    () =>
      bookings.flatMap((booking) => {
        const start = new Date(booking.startsAt);
        const end = new Date(booking.endsAt);
        const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
        const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
        const clippedStartMin = Math.max(startMin, timelineStartMin);
        const clippedEndMin = Math.min(endMin, timelineEndMin);

        if (clippedStartMin >= clippedEndMin) {
          return [];
        }

        return [
          {
            booking,
            startMin: clippedStartMin,
            endMin: clippedEndMin,
          },
        ];
      }),
    [bookings, timelineEndMin, timelineStartMin],
  );

  // Sorted capped slots for the mapping function.
  const sortedCollapsed = useMemo(
    () =>
      visibleTimelineSlots
        .filter((s) => s.endMin - s.startMin > COLLAPSE_THRESHOLD_MIN)
        .sort((a, b) => a.startMin - b.startMin),
    [visibleTimelineSlots],
  );

  const toPixel = useCallback(
    (minute: number) => minuteToPixel(minute, minHour * 60, sortedCollapsed),
    [minHour, sortedCollapsed],
  );

  // No working hours and no bookings
  if (visibleBookings.length === 0 && visibleTimelineSlots.length === 0) {
    return (
      <div className={'text-muted-foreground py-12 text-center text-sm'}>{t('noBookings')}</div>
    );
  }

  // No bookings but is a working day
  if (visibleBookings.length === 0 && visibleTimelineSlots.length > 0) {
    return (
      <div className={'space-y-2'}>
        {visibleTimelineSlots.map((slot) => (
          <TimelineEmptySlot
            key={`${slot.kind}-${slot.startMin}`}
            slot={slot}
            date={date}
            top={0}
            height={0}
            listMode
            serviceDurations={serviceDurations}
            onEmptySlotClick={onEmptySlotClick}
          />
        ))}
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
    const labels: { hour: number; emphasized: boolean }[] = [];
    const startHour = Math.floor(slot.startMin / 60) + 1;
    const endHour = Math.ceil(slot.endMin / 60) - 1;
    for (let h = startHour; h <= endHour; h++) {
      const hMin = h * 60;
      if (hMin > slot.startMin && hMin < slot.endMin) {
        const emphasized =
          (slot.startMin % 60 !== 0 && labels.length === 0) ||
          (slot.endMin % 60 !== 0 && h === endHour);
        if (emphasized) {
          labels.push({ hour: h, emphasized });
        }
      }
    }
    return labels;
  });

  const collapsedRails = sortedCollapsed
    .map((slot) => {
      const startMinute =
        slot.startMin % 60 === 0 ? slot.startMin : Math.ceil(slot.startMin / 60) * 60;
      const endMinute = slot.endMin % 60 === 0 ? slot.endMin : Math.floor(slot.endMin / 60) * 60;
      return { startMinute, endMinute };
    })
    .filter(({ startMinute, endMinute }) => endMinute > startMinute);

  const quarterMarkers: { minute: number; offset: 15 | 30 | 45 }[] = [];
  for (let h = minHour; h < maxHour; h++) {
    for (const offset of [15, 30, 45] as const) {
      const minute = h * 60 + offset;
      const insideCompressedMiddle = sortedCollapsed.some((s) =>
        isCompressedSlotMiddleMinute(minute, s),
      );
      if (!insideCompressedMiddle) {
        quarterMarkers.push({ minute, offset });
      }
    }
  }

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
      {/* Hour labels */}
      {hourLabels.map((hour) => (
        <div
          key={hour}
          className={
            'pointer-events-none absolute left-0 flex w-12 -translate-y-1/2 items-center gap-1'
          }
          style={{ top: toPixel(hour * 60) }}
        >
          <span className={'text-muted-foreground text-xs leading-none font-semibold'}>
            {formatHour(hour)}
          </span>
        </div>
      ))}

      {compressedHourLabels.map(({ hour, emphasized }) => (
        <div
          key={`compressed-${hour}`}
          className={
            'pointer-events-none absolute left-0 flex w-12 -translate-y-1/2 items-center gap-1'
          }
          style={{ top: toPixel(hour * 60) }}
        >
          <span
            className={
              emphasized
                ? 'text-muted-foreground text-xs leading-none font-semibold'
                : 'text-muted-foreground/50 text-[10px] leading-none'
            }
          >
            {formatHour(hour)}
          </span>
        </div>
      ))}

      {collapsedRails.map(({ startMinute, endMinute }) => {
        const railTop = toPixel(startMinute) + 12;
        const railHeight = Math.max(0, toPixel(endMinute) - toPixel(startMinute) - 24);
        return (
          <div
            key={`collapsed-rail-${startMinute}-${endMinute}`}
            className={'pointer-events-none absolute left-1 w-px overflow-hidden'}
            style={{
              top: railTop,
              height: railHeight,
              backgroundImage:
                'repeating-linear-gradient(to bottom, var(--muted-foreground) 0 3px, transparent 3px 8px)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
              maskImage:
                'linear-gradient(to bottom, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
            }}
          />
        );
      })}

      {quarterMarkers.map(({ minute, offset }) => (
        <div
          key={`quarter-marker-${minute}`}
          className={
            'pointer-events-none absolute left-0 flex w-12 -translate-y-1/2 items-center gap-1'
          }
          style={{ top: toPixel(minute) }}
        >
          <span
            className={`bg-muted-foreground/45 dark:bg-muted-foreground h-0.5 shrink-0 rounded-full ${offset === 30 ? 'w-5' : 'w-3'}`}
          />
        </div>
      ))}

      {/* Empty slot cards */}
      {visibleTimelineSlots.map((slot) => {
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
            serviceDurations={serviceDurations}
            onEmptySlotClick={onEmptySlotClick}
          />
        );
      })}

      {/* Booking cards */}
      {visibleBookings.map(({ booking, startMin, endMin }) => {
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
