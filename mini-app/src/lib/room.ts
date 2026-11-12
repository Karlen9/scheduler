import { formatDateISO } from './helpers';
import { startOfWeekMonday } from './work-days-draft';

import type { TRoomColor, TRoomDay, TRoomMember, TWorkingInterval } from './types';
import type { TWeekday } from './work-days-draft';

/** Fixed palette accepted by the backend, in the order swatches are offered. */
export const ROOM_COLORS: TRoomColor[] = ['green', 'violet', 'orange', 'blue', 'pink', 'teal'];

export const MAX_ROOM_MEMBERS = 6;

/** CSS colour (theme-aware token) for a palette key; unknown keys fall back to green. */
export function roomColorVar(color: string | undefined): string {
  const key = ROOM_COLORS.includes(color as TRoomColor) ? color : 'green';
  return `var(--room-${key})`;
}

/** First palette colour not used by any member (or the first colour when all are taken). */
export function firstUnusedColor(members: TRoomMember[]): TRoomColor {
  const used = new Set(members.map((m) => m.color));
  return ROOM_COLORS.find((c) => !used.has(c)) ?? ROOM_COLORS[0];
}

/** date -> owning member id, for every room day (past included). */
export function buildOwnerMap(days: TRoomDay[] | undefined): Map<string, string> {
  const owners = new Map<string, string>();
  for (const day of days ?? []) {
    owners.set(day.date.slice(0, 10), day.memberId);
  }
  return owners;
}

/***************************************************************************************************
 * Local, unsaved assignment changes of the room calendar: date -> member id ("" = free). Only
 * dates that differ from the server are kept.
 ***************************************************************************************************/
export type TRoomOverrides = Map<string, string>;

export function effectiveOwner(
  serverOwners: Map<string, string>,
  overrides: TRoomOverrides,
  date: string,
): string {
  return overrides.has(date) ? (overrides.get(date) ?? '') : (serverOwners.get(date) ?? '');
}

/** Sets an override, dropping it when it equals the server state. */
export function setOverride(
  serverOwners: Map<string, string>,
  overrides: TRoomOverrides,
  date: string,
  memberId: string,
): TRoomOverrides {
  const next = new Map(overrides);
  if ((serverOwners.get(date) ?? '') === memberId) {
    next.delete(date);
  } else {
    next.set(date, memberId);
  }
  return next;
}

/** Assignment payload for PUT /api/admin/room/days: future dates only, sorted. */
export function overridesToAssignments(
  overrides: TRoomOverrides,
  today: Date = new Date(),
): { date: string; memberId: string }[] {
  const todayISO = formatDateISO(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  return [...overrides]
    .filter(([date]) => date >= todayISO)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, memberId]) => ({ date, memberId }));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export type TRoomRepeatPlan = {
  targetWeek: string;
  additions: [string, string][];
};

/***************************************************************************************************
 * Room "repeat last week": target = first Mon-Sun week (from the current one) in which none of
 * the assignable members (me + offline colleagues) owns a day; source = the week before it. Days
 * the assignable members had in the source week are copied onto FREE, not-past days of the
 * target. Linked colleagues' days are never touched.
 ***************************************************************************************************/
export function planRoomRepeatLastWeek(
  owners: Map<string, string>,
  assignable: Set<string>,
  today: Date,
  maxWeeksAhead = 26,
): TRoomRepeatPlan | null {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayISO = formatDateISO(todayStart);
  const currentWeek = startOfWeekMonday(todayStart);

  for (let w = 0; w < maxWeeksAhead; w++) {
    const targetStart = addDays(currentWeek, w * 7);
    let hasOwn = false;
    for (let d = 0; d < 7; d++) {
      if (assignable.has(owners.get(formatDateISO(addDays(targetStart, d))) ?? '')) {
        hasOwn = true;
        break;
      }
    }
    if (hasOwn) {
      continue;
    }

    const sourceStart = addDays(targetStart, -7);
    const additions: [string, string][] = [];
    for (let d = 0; d < 7; d++) {
      const sourceOwner = owners.get(formatDateISO(addDays(sourceStart, d))) ?? '';
      const targetISO = formatDateISO(addDays(targetStart, d));
      if (assignable.has(sourceOwner) && targetISO >= todayISO && !owners.get(targetISO)) {
        additions.push([targetISO, sourceOwner]);
      }
    }
    return { targetWeek: formatDateISO(targetStart), additions };
  }
  return null;
}

export type TRoomAlternatingParams = {
  /** Weekdays per assignable member id for week A / week B. */
  weekA: Record<string, TWeekday[]>;
  weekB: Record<string, TWeekday[]>;
  startOffsetWeeks: 0 | 1;
  horizonWeeks: number;
};

/***************************************************************************************************
 * Room "alternating weeks": returns [date, memberId] pairs for not-past dates that are free or
 * already owned by an assignable member. Days of linked colleagues are never touched; when two
 * members claim the same weekday the first member in `assignableOrder` wins.
 ***************************************************************************************************/
export function planRoomAlternatingWeeks(
  owners: Map<string, string>,
  assignableOrder: string[],
  today: Date,
  params: TRoomAlternatingParams,
): [string, string][] {
  const assignable = new Set(assignableOrder);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayISO = formatDateISO(todayStart);
  const firstWeek = addDays(startOfWeekMonday(todayStart), params.startOffsetWeeks * 7);
  const result: [string, string][] = [];

  for (let w = 0; w < params.horizonWeeks; w++) {
    const weekStart = addDays(firstWeek, w * 7);
    const pattern = w % 2 === 0 ? params.weekA : params.weekB;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const iso = formatDateISO(date);
      const currentOwner = owners.get(iso) ?? '';
      if (iso < todayISO || (currentOwner !== '' && !assignable.has(currentOwner))) {
        continue;
      }
      const memberId = assignableOrder.find((id) => pattern[id]?.includes(date.getDay()));
      if (memberId && memberId !== currentOwner) {
        result.push([iso, memberId]);
      }
    }
  }
  return result;
}

/** Hours changes of days I own, keyed by date (null = default hours). */
export type TRoomHours = Map<string, TWorkingInterval[] | null>;

/** Active-booking counts per date from an admin schedule context (`bookedDates` + `bookingCount`). */
export function buildBookingCounts(
  ctx:
    | {
        bookedDates?: { date: string; bookingCount: number }[];
        workDates?: { date: string; bookingCount?: number }[];
      }
    | null
    | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of ctx?.bookedDates ?? []) {
    counts.set(entry.date.slice(0, 10), entry.bookingCount);
  }
  for (const entry of ctx?.workDates ?? []) {
    const iso = entry.date.slice(0, 10);
    counts.set(iso, Math.max(counts.get(iso) ?? 0, entry.bookingCount ?? 0));
  }
  for (const [iso, count] of counts) {
    if (count <= 0) {
      counts.delete(iso);
    }
  }
  return counts;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/***************************************************************************************************
 * Lines of the shareable schedule: one per member who has days in the next `days` days, e.g.
 * "Аня — 17, 19, 24 нояб." (dates grouped per month, in member order).
 ***************************************************************************************************/
export function buildScheduleLines(
  owners: Map<string, string>,
  members: { id: string; name: string }[],
  today: Date,
  days: number,
  monthShort: (monthIndex: number) => string,
): string[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startISO = formatDateISO(start);
  const endISO = formatDateISO(addDays(start, days - 1));
  const lines: string[] = [];

  for (const member of members) {
    const dates = [...owners]
      .filter(([iso, id]) => id === member.id && iso >= startISO && iso <= endISO)
      .map(([iso]) => iso)
      .sort();
    if (dates.length === 0) {
      continue;
    }
    const groups: { month: number; days: number[] }[] = [];
    for (const iso of dates) {
      const date = parseISO(iso);
      const last = groups[groups.length - 1];
      if (last?.month === date.getMonth()) {
        last.days.push(date.getDate());
      } else {
        groups.push({ month: date.getMonth(), days: [date.getDate()] });
      }
    }
    const text = groups.map((g) => `${g.days.join(', ')} ${monthShort(g.month)}`).join(' ');
    lines.push(`${member.name} — ${text}`);
  }
  return lines;
}

/** "ноябрь" or "ноябрь–декабрь": the months covered by the next `days` days. */
export function scheduleMonthSpan(
  today: Date,
  days: number,
  monthName: (monthIndex: number) => string,
): string {
  const first = today.getMonth();
  const last = addDays(today, days - 1).getMonth();
  return first === last ? monthName(first) : `${monthName(first)}–${monthName(last)}`;
}
