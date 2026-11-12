import { addMinutesToISO, addMinutesToTime, formatDateISO, timeToMinutes } from './utils';

import type { TBooking, TRoomMember, TWorkingInterval } from '../types';
import type { TMockRoom, TMockWorkDates } from './room-types';
import type { TMockState } from './types';

export const ROOM_ME_ID = 'mock-member-me';
export const ROOM_ANNA_ID = 'mock-member-anna';
export const ROOM_OLGA_ID = 'mock-member-olga';
const DEFAULT_INTERVAL: TWorkingInterval = { startTime: '10:00', endTime: '20:00' };
export const ROOM_DEFAULT_INTERVALS: TWorkingInterval[] = Array.of(DEFAULT_INTERVAL);
export const ROOM_CUSTOM_INTERVALS: TWorkingInterval[] = [{ startTime: '12:00', endTime: '18:00' }];

/** How many weeks of ownership are generated, counted from the Monday of the previous week. */
const ROOM_WEEKS = 9;
const ACTIVE_STATUSES = new Set<TBooking['status']>([
  'pending',
  'confirmed',
  'reschedule_pending',
  'cancel_requested',
]);
const MAX_ACTIVE_PER_DAY = 4;

type TWeekPattern = Record<'me' | 'anna' | 'olga', number[]>;

// Weekday numbers follow Date#getDay: 0 = Sunday. Sundays stay free.
const WEEK_A: TWeekPattern = { me: [1, 3, 5], anna: [2, 4], olga: [6] };
const WEEK_B: TWeekPattern = { me: [2, 4, 6], anna: [1, 3], olga: [5] };

export function mondayOfPreviousWeek(today: Date): Date {
  const day = today.getDay();
  const sinceMonday = day === 0 ? 6 : day - 1;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday - 7);
}

/** Date of weekday `weekday` (0 = Sunday) in week `weekIndex` counted from the previous Monday. */
function dateOf(start: Date, weekIndex: number, weekday: number): string {
  const offset = weekIndex * 7 + (weekday === 0 ? 6 : weekday - 1);
  return formatDateISO(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset));
}

export type TRoomPlan = {
  owners: Map<string, string>;
  /** My day next week that stays without bookings: the target of the incoming request. */
  incomingRequestDate: string;
  /** A colleague's day the week after next: the target of my outgoing request. */
  outgoingRequestDate: string;
  /** My day with custom hours (12:00-18:00). */
  customHoursDate: string;
  freeDates: string[];
};

/***************************************************************************************************
 * Day ownership of the room from the Monday of the previous week on: weeks alternate between
 * pattern A and B, Sundays stay free, and three future days are left free on purpose.
 ***************************************************************************************************/
export function buildRoomPlan(today: Date): TRoomPlan {
  const start = mondayOfPreviousWeek(today);
  const owners = new Map<string, string>();
  const idByKey = { me: ROOM_ME_ID, anna: ROOM_ANNA_ID, olga: ROOM_OLGA_ID } as const;

  for (let week = 0; week < ROOM_WEEKS; week++) {
    const pattern = week % 2 === 0 ? WEEK_A : WEEK_B;
    for (const key of ['me', 'anna', 'olga'] as const) {
      for (const weekday of pattern[key]) {
        owners.set(dateOf(start, week, weekday), idByKey[key]);
      }
    }
  }

  const freeDates = [dateOf(start, 2, 4), dateOf(start, 3, 3), dateOf(start, 4, 5)];
  for (const date of freeDates) {
    owners.delete(date);
  }

  return {
    owners,
    incomingRequestDate: dateOf(start, 2, 3),
    outgoingRequestDate: dateOf(start, 3, 1),
    customHoursDate: dateOf(start, 2, 1),
    freeDates,
  };
}

function intervalsOf(
  workDates: TMockWorkDates,
  defaults: TWorkingInterval[],
  date: string,
): TWorkingInterval[] {
  return workDates.get(date) ?? defaults;
}

type TBookingRef = { booking: TBooking; apply: (next: TBooking) => void };

function collectBookingRefs(state: TMockState): TBookingRef[] {
  const refs: TBookingRef[] = [];
  state.bookings.forEach((booking, index) => {
    refs.push({
      booking,
      apply: (next) => {
        state.bookings[index] = next;
      },
    });
  });
  state.recurringSchedules.forEach((schedule) => {
    (schedule.bookings ?? []).forEach((booking, index) => {
      refs.push({
        booking,
        apply: (next) => {
          if (schedule.bookings) {
            schedule.bookings[index] = next;
          }
        },
      });
    });
  });
  return refs;
}

/***************************************************************************************************
 * Moves the generated bookings onto the specialist's own days so the room scenario stays
 * consistent (nobody books a colleague's day) while the dashboard and lists still look full.
 * Bookings before `windowStart` stay as they are. A booking goes to the nearest own day on the
 * same side of today (past stays past), keeping its time of day when that is free and otherwise
 * taking the first free start inside the day's hours; days are capped at a few active bookings.
 ***************************************************************************************************/
export function relocateBookings(
  state: TMockState,
  myDays: string[],
  workDates: TMockWorkDates,
  defaults: TWorkingInterval[],
  reservedEmpty: Set<string>,
  today: Date,
  windowStart: Date,
): void {
  const todayISO = formatDateISO(today);
  const windowStartISO = formatDateISO(windowStart);
  const candidates = myDays.filter((d) => !reservedEmpty.has(d)).sort();
  const busy = new Map<string, { start: number; end: number }[]>();
  const activeCount = new Map<string, number>();

  const refs = collectBookingRefs(state)
    .filter(({ booking }) => booking.startsAt.slice(0, 10) >= windowStartISO)
    .sort((a, b) => a.booking.startsAt.localeCompare(b.booking.startsAt));

  function fits(date: string, start: number, duration: number): boolean {
    const inside = intervalsOf(workDates, defaults, date).some(
      (i) => start >= timeToMinutes(i.startTime) && start + duration <= timeToMinutes(i.endTime),
    );
    if (!inside) {
      return false;
    }
    return !(busy.get(date) ?? []).some((b) => start < b.end && start + duration > b.start);
  }

  function findStart(date: string, preferred: number, duration: number): number | null {
    if (fits(date, preferred, duration)) {
      return preferred;
    }
    for (const interval of intervalsOf(workDates, defaults, date)) {
      for (
        let m = timeToMinutes(interval.startTime);
        m + duration <= timeToMinutes(interval.endTime);
        m += 30
      ) {
        if (fits(date, m, duration)) {
          return m;
        }
      }
    }
    return null;
  }

  for (const { booking, apply } of refs) {
    const original = booking.startsAt.slice(0, 10);
    const sameSide = candidates.filter((d) => original >= todayISO === d >= todayISO);
    const pool = sameSide.length > 0 ? sameSide : candidates;
    const ordered = [...pool].sort(
      (a, b) =>
        Math.abs(new Date(a).getTime() - new Date(original).getTime()) -
        Math.abs(new Date(b).getTime() - new Date(original).getTime()),
    );
    const duration = booking.durationMinutes ?? 60;
    const preferred = timeToMinutes(booking.startsAt.slice(11, 16));
    const active = ACTIVE_STATUSES.has(booking.status);

    let placed: { date: string; start: number } | null = null;
    for (const date of ordered) {
      if (active && (activeCount.get(date) ?? 0) >= MAX_ACTIVE_PER_DAY) {
        continue;
      }
      const start = active
        ? findStart(date, preferred, duration)
        : intervalsOf(workDates, defaults, date).length > 0
          ? preferred
          : null;
      if (start !== null) {
        placed = { date, start };
        break;
      }
    }
    placed ??= { date: ordered[0] ?? original, start: preferred };

    if (active) {
      busy.set(placed.date, [
        ...(busy.get(placed.date) ?? []),
        { start: placed.start, end: placed.start + duration },
      ]);
      activeCount.set(placed.date, (activeCount.get(placed.date) ?? 0) + 1);
    }
    const startsAt = `${placed.date}T${addMinutesToTime('00:00', placed.start)}:00Z`;
    apply({ ...booking, startsAt, endsAt: addMinutesToISO(startsAt, duration) });
  }
}

/***************************************************************************************************
 * Builds the "room" scenario on top of the default mock state: the specialist works by dates in
 * a shared room with a linked colleague (Анна) and an offline one (Ольга).
 ***************************************************************************************************/
export function createRoomScenarioState(base: TMockState, now: Date = new Date()): TMockState {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = mondayOfPreviousWeek(today);
  const plan = buildRoomPlan(today);
  const state: TMockState = {
    ...base,
    bookings: [...base.bookings],
    recurringSchedules: base.recurringSchedules.map((schedule) => ({
      ...schedule,
      bookings: schedule.bookings ? [...schedule.bookings] : schedule.bookings,
    })),
  };

  const myDays = [...plan.owners].filter(([, id]) => id === ROOM_ME_ID).map(([date]) => date);
  const workDates: TMockWorkDates = new Map(myDays.map((date) => [date, null]));
  workDates.set(plan.customHoursDate, ROOM_CUSTOM_INTERVALS);

  relocateBookings(
    state,
    myDays,
    workDates,
    ROOM_DEFAULT_INTERVALS,
    new Set([plan.incomingRequestDate]),
    today,
    windowStart,
  );

  const annaDays = [...plan.owners]
    .filter(([, id]) => id === ROOM_ANNA_ID)
    .map(([date]) => date)
    .sort();
  // Anna has bookings on most of her days (all but every fourth one).
  const colleagueBookingDates = new Set(annaDays.filter((_, index) => index % 4 !== 3));
  colleagueBookingDates.add(plan.outgoingRequestDate);

  const members: TRoomMember[] = [
    { id: ROOM_ME_ID, name: state.adminProfile.name, color: 'green', linked: true, isMe: true },
    { id: ROOM_ANNA_ID, name: 'Анна Смирнова', color: 'violet', linked: true },
    { id: ROOM_OLGA_ID, name: 'Ольга', color: 'orange', linked: false, hasInvite: false },
  ];

  const room: TMockRoom = {
    id: 'mock-room',
    name: 'Кабинет на Ленина',
    isCreator: true,
    meMemberId: ROOM_ME_ID,
    members,
    owners: plan.owners,
    colleagueBookingDates,
    invites: new Map(),
    incoming: Array.of({
      id: 'mock-room-request-in',
      date: plan.incomingRequestDate,
      memberId: ROOM_ANNA_ID,
    }),
    outgoing: Array.of({
      id: 'mock-room-request-out',
      date: plan.outgoingRequestDate,
      memberId: ROOM_ANNA_ID,
    }),
  };

  return {
    ...state,
    adminNotifications: { ...state.adminNotifications, notifyWorkDaysReminder: true },
    defaultIntervals: ROOM_DEFAULT_INTERVALS.map((i) => ({ ...i })),
    room,
    scenario: 'room',
    scheduleMode: 'dates',
    workDates,
  };
}
