import { formatDateISO, getNonWorkingDays } from './helpers';

import type { TScheduleMode, TWorkDate, TWorkingHours, TWorkingInterval } from './types';

/***************************************************************************************************
 * Structural subset of the public and admin schedule contexts that the calendar helpers need.
 *
 * Every field is optional on purpose: older backends and the local mock API do not send
 * `scheduleMode` / `workDates`, and such a context must behave exactly like the weekly schedule.
 ***************************************************************************************************/
export type TWorkCalendarContext = {
  scheduleMode?: TScheduleMode;
  workingHours?: TWorkingHours[];
  daysOff?: { date: string }[];
  workDates?: (TWorkDate & { custom?: boolean })[];
  defaultIntervals?: TWorkingInterval[];
};

export type TCalendarAvailability = {
  nonWorkingDays: number[];
  daysOff: string[];
  /** Present only in dates mode: every date outside the set is closed. */
  openDates?: Set<string>;
};

function toISO(date: Date | string): string {
  return typeof date === 'string' ? date.slice(0, 10) : formatDateISO(date);
}

function toLocalDate(date: Date | string): Date {
  if (typeof date !== 'string') {
    return date;
  }
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/***************************************************************************************************
 * Returns true when the schedule works by explicitly opened dates instead of a weekly template.
 ***************************************************************************************************/
export function isDatesMode(ctx: TWorkCalendarContext | null | undefined): boolean {
  return ctx?.scheduleMode === 'dates';
}

/***************************************************************************************************
 * Returns the set of opened dates (YYYY-MM-DD). Empty outside dates mode.
 ***************************************************************************************************/
export function getOpenDateSet(ctx: TWorkCalendarContext | null | undefined): Set<string> {
  if (!isDatesMode(ctx)) {
    return new Set();
  }
  return new Set((ctx?.workDates ?? []).map((wd) => wd.date.slice(0, 10)));
}

/***************************************************************************************************
 * Returns the working intervals of one calendar date, shaped like weekly working hours so that
 * existing timeline and slot code can consume them unchanged.
 *
 * - dates mode: the effective intervals of the opened date, or [] when the date is closed;
 * - weekly mode: the template hours of that weekday, or [] on a day off.
 ***************************************************************************************************/
export function getIntervalsForDate(
  ctx: TWorkCalendarContext | null | undefined,
  date: Date | string,
): TWorkingHours[] {
  const iso = toISO(date);
  const dayOfWeek = toLocalDate(date).getDay();

  if (isDatesMode(ctx)) {
    const workDate = (ctx?.workDates ?? []).find((wd) => wd.date.slice(0, 10) === iso);
    if (!workDate) {
      return [];
    }
    // Public contexts send effective intervals and no `custom` flag; admin contexts mark days
    // without own hours as custom=false and the default hours apply.
    const hasOwnHours = (workDate.custom ?? true) && Boolean(workDate.intervals?.length);
    const intervals = hasOwnHours
      ? workDate.intervals
      : (ctx?.defaultIntervals ?? workDate.intervals ?? []);
    return intervals.map((interval) => ({
      dayOfWeek,
      startTime: interval.startTime,
      endTime: interval.endTime,
    }));
  }

  if ((ctx?.daysOff ?? []).some((d) => d.date.slice(0, 10) === iso)) {
    return [];
  }
  return (ctx?.workingHours ?? []).filter((wh) => wh.dayOfWeek === dayOfWeek);
}

/***************************************************************************************************
 * Returns the props a calendar needs to grey out closed days.
 *
 * Weekly mode yields exactly what the pages computed before (`getNonWorkingDays` + days off);
 * dates mode yields an `openDates` set and no weekday/day-off rules.
 ***************************************************************************************************/
export function getCalendarAvailability(
  ctx: TWorkCalendarContext | null | undefined,
): TCalendarAvailability {
  if (isDatesMode(ctx)) {
    return { nonWorkingDays: [], daysOff: [], openDates: getOpenDateSet(ctx) };
  }
  return {
    nonWorkingDays: getNonWorkingDays(ctx?.workingHours ?? []),
    daysOff: (ctx?.daysOff ?? []).map((d) => d.date),
  };
}

/***************************************************************************************************
 * Returns up to `n` opened dates (YYYY-MM-DD, ascending) that are today or later.
 ***************************************************************************************************/
export function getUpcomingOpenDates(
  ctx: TWorkCalendarContext | null | undefined,
  n: number,
  today: Date = new Date(),
): string[] {
  const todayISO = formatDateISO(today);
  return [...getOpenDateSet(ctx)]
    .filter((iso) => iso >= todayISO)
    .sort()
    .slice(0, n);
}

/***************************************************************************************************
 * Counts the open dates in [today, today + days - 1].
 ***************************************************************************************************/
export function countOpenDatesWithin(
  ctx: TWorkCalendarContext | null | undefined,
  days: number,
  today: Date = new Date(),
): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days - 1);
  const startISO = formatDateISO(start);
  const endISO = formatDateISO(end);
  let count = 0;
  for (const iso of getOpenDateSet(ctx)) {
    if (iso >= startISO && iso <= endISO) {
      count++;
    }
  }
  return count;
}

/***************************************************************************************************
 * Returns true when at least one date in [today, today + days - 1] is open.
 ***************************************************************************************************/
export function hasOpenDateWithin(
  ctx: TWorkCalendarContext | null | undefined,
  days: number,
  today: Date = new Date(),
): boolean {
  return countOpenDatesWithin(ctx, days, today) > 0;
}

/***************************************************************************************************
 * Builds weekly hours (all seven weekdays) from a single set of default intervals. Used to feed
 * the weekly-shaped recurring flow in dates mode.
 ***************************************************************************************************/
export function weeklyHoursFromIntervals(intervals: TWorkingInterval[]): TWorkingHours[] {
  const result: TWorkingHours[] = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    for (const interval of intervals) {
      result.push({ dayOfWeek, startTime: interval.startTime, endTime: interval.endTime });
    }
  }
  return result;
}
