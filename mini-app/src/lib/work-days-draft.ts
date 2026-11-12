import { formatDateISO } from './helpers';

import type { TAdminWorkDate, TWorkDatesUpdate, TWorkingInterval } from './types';

/***************************************************************************************************
 * Local, unsaved state of the work-days calendar.
 *
 * A key present in the map means the date is open. The value is the date's own hours, or null
 * when it uses the specialist's default hours.
 ***************************************************************************************************/
export type TWorkDaysDraft = Map<string, TWorkingInterval[] | null>;

/** Weekday index in JS terms: 0 = Sunday ... 6 = Saturday. */
export type TWeekday = number;

function serializeIntervals(intervals: TWorkingInterval[] | null): string {
  if (!intervals || intervals.length === 0) {
    return '';
  }
  return JSON.stringify(intervals.map((i) => [i.startTime, i.endTime]));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week that contains `date`. */
export function startOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  return addDays(startOfDay(date), day === 0 ? -6 : 1 - day);
}

/***************************************************************************************************
 * Builds the draft that mirrors the server state (custom hours stay, default hours become null).
 ***************************************************************************************************/
export function draftFromWorkDates(workDates: TAdminWorkDate[] | undefined): TWorkDaysDraft {
  const draft: TWorkDaysDraft = new Map();
  for (const wd of workDates ?? []) {
    draft.set(wd.date.slice(0, 10), wd.custom && wd.intervals?.length ? wd.intervals : null);
  }
  return draft;
}

/***************************************************************************************************
 * Computes the payload for PUT /api/admin/work-dates: dates that are new or whose hours changed
 * go to `open`, dates that disappeared from the draft go to `close`. Both lists are sorted.
 *
 * Dates before `today` are read-only history: they are never part of the diff, whatever the
 * draft says about them.
 ***************************************************************************************************/
export function diffWorkDates(
  server: TWorkDaysDraft,
  draft: TWorkDaysDraft,
  today: Date = new Date(),
): TWorkDatesUpdate {
  const todayISO = formatDateISO(startOfDay(today));
  const open: TWorkDatesUpdate['open'] = [];
  const close: string[] = [];

  for (const [date, intervals] of draft) {
    if (date < todayISO) {
      continue;
    }
    if (
      !server.has(date) ||
      serializeIntervals(server.get(date) ?? null) !== serializeIntervals(intervals)
    ) {
      open.push({ date, intervals });
    }
  }
  for (const date of server.keys()) {
    if (date >= todayISO && !draft.has(date)) {
      close.push(date);
    }
  }

  open.sort((a, b) => a.date.localeCompare(b.date));
  close.sort();
  return { open, close };
}

export function countWorkDateChanges(
  server: TWorkDaysDraft,
  draft: TWorkDaysDraft,
  today: Date = new Date(),
): number {
  const diff = diffWorkDates(server, draft, today);
  return diff.open.length + diff.close.length;
}

export type TRepeatWeekPlan = {
  /** Monday (YYYY-MM-DD) of the week that receives the copied days. */
  targetWeek: string;
  /** Dates (and hours) to add to the draft. Empty when the source week has nothing to copy. */
  additions: [string, TWorkingInterval[] | null][];
};

/***************************************************************************************************
 * "Repeat last week": finds the first Mon-Sun week, starting at the current one, that has no
 * open date at all (past days of the current week count: a week the specialist has already
 * started is not an empty target), and copies all seven weekdays opened in the week before it
 * (with their hours; past days serve only as a source) onto the target's not-past days. Looks at
 * most `maxWeeksAhead` weeks ahead.
 *
 * Returns null when no empty target week exists in range.
 ***************************************************************************************************/
export function planRepeatLastWeek(
  draft: TWorkDaysDraft,
  today: Date,
  maxWeeksAhead = 26,
): TRepeatWeekPlan | null {
  const todayStart = startOfDay(today);
  const todayISO = formatDateISO(todayStart);
  const currentWeek = startOfWeekMonday(todayStart);

  for (let w = 0; w < maxWeeksAhead; w++) {
    const targetStart = addDays(currentWeek, w * 7);
    let hasOpen = false;
    for (let d = 0; d < 7; d++) {
      if (draft.has(formatDateISO(addDays(targetStart, d)))) {
        hasOpen = true;
        break;
      }
    }
    if (hasOpen) {
      continue;
    }

    const sourceStart = addDays(targetStart, -7);
    const additions: TRepeatWeekPlan['additions'] = [];
    for (let d = 0; d < 7; d++) {
      const sourceISO = formatDateISO(addDays(sourceStart, d));
      const targetISO = formatDateISO(addDays(targetStart, d));
      if (draft.has(sourceISO) && targetISO >= todayISO) {
        additions.push([targetISO, draft.get(sourceISO) ?? null]);
      }
    }
    return { targetWeek: formatDateISO(targetStart), additions };
  }
  return null;
}

export type TAlternatingWeeksParams = {
  weekA: TWeekday[];
  weekB: TWeekday[];
  /** 0 = start with the current week, 1 = start with the next week. */
  startOffsetWeeks: 0 | 1;
  horizonWeeks: number;
};

/***************************************************************************************************
 * "Alternating weeks": returns the dates (not past, not already open in the draft) that the
 * A/B weekday pattern would open over the horizon. Never removes anything.
 ***************************************************************************************************/
export function planAlternatingWeeks(
  draft: TWorkDaysDraft,
  today: Date,
  params: TAlternatingWeeksParams,
): string[] {
  const todayISO = formatDateISO(startOfDay(today));
  const firstWeek = addDays(startOfWeekMonday(today), params.startOffsetWeeks * 7);
  const result: string[] = [];

  for (let w = 0; w < params.horizonWeeks; w++) {
    const weekStart = addDays(firstWeek, w * 7);
    const weekdays = w % 2 === 0 ? params.weekA : params.weekB;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      if (!weekdays.includes(date.getDay())) {
        continue;
      }
      const iso = formatDateISO(date);
      if (iso >= todayISO && !draft.has(iso)) {
        result.push(iso);
      }
    }
  }
  return result;
}
