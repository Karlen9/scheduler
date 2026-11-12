import { describe, expect, it } from 'vitest';

import { getNonWorkingDays } from '../helpers';
import {
  countOpenDatesWithin,
  getCalendarAvailability,
  getIntervalsForDate,
  getOpenDateSet,
  getUpcomingOpenDates,
  hasOpenDateWithin,
  isDatesMode,
  weeklyHoursFromIntervals,
} from '../work-calendar';

import type { TWorkCalendarContext } from '../work-calendar';

function hoursOf(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): { dayOfWeek: number; startTime: string; endTime: string }[] {
  return Array.of({ dayOfWeek, startTime, endTime });
}

const weeklyHours = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
  { dayOfWeek: 3, startTime: '10:00', endTime: '14:00' },
  { dayOfWeek: 3, startTime: '15:00', endTime: '19:00' },
];

const weeklyCtx: TWorkCalendarContext = {
  workingHours: weeklyHours,
  daysOff: [{ date: '2026-11-18' }],
};

const datesCtx: TWorkCalendarContext = {
  scheduleMode: 'dates',
  workingHours: weeklyHours,
  daysOff: [{ date: '2026-11-18' }],
  defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
  workDates: [
    { date: '2026-11-18', intervals: [{ startTime: '10:00', endTime: '20:00' }], custom: false },
    { date: '2026-11-20', intervals: [{ startTime: '12:00', endTime: '16:00' }], custom: true },
    { date: '2026-12-02', intervals: [{ startTime: '10:00', endTime: '20:00' }], custom: false },
  ],
};

describe('weekly mode (regression)', () => {
  it('treats a missing scheduleMode as weekly', () => {
    expect(isDatesMode(weeklyCtx)).toBe(false);
    expect(isDatesMode(null)).toBe(false);
    expect(isDatesMode(undefined)).toBe(false);
  });

  it('returns exactly what getNonWorkingDays and the days off list produced before', () => {
    expect(getCalendarAvailability(weeklyCtx)).toEqual({
      nonWorkingDays: getNonWorkingDays(weeklyHours),
      daysOff: ['2026-11-18'],
    });
    expect(getCalendarAvailability(weeklyCtx).openDates).toBeUndefined();
  });

  it('keeps every weekday non-working for an empty or missing context', () => {
    expect(getCalendarAvailability(null).nonWorkingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(getCalendarAvailability({ workingHours: [], daysOff: [] }).daysOff).toEqual([]);
  });

  it('ignores workDates when the mode is weekly', () => {
    const ctx = { ...weeklyCtx, scheduleMode: 'weekly' as const, workDates: datesCtx.workDates };
    expect(getOpenDateSet(ctx).size).toBe(0);
    expect(getCalendarAvailability(ctx).openDates).toBeUndefined();
  });

  it('returns the weekday template for a date and nothing on a day off', () => {
    // 2026-11-16 is a Monday, 2026-11-18 a Wednesday that is also a day off.
    expect(getIntervalsForDate(weeklyCtx, '2026-11-16')).toEqual(hoursOf(1, '09:00', '18:00'));
    expect(getIntervalsForDate(weeklyCtx, '2026-11-18')).toEqual([]);
    expect(getIntervalsForDate(weeklyCtx, '2026-11-25')).toHaveLength(2);
    expect(getIntervalsForDate(weeklyCtx, new Date(2026, 10, 17))).toEqual([]);
  });
});

describe('dates mode', () => {
  it('drops weekday and day-off rules and exposes the open dates', () => {
    const availability = getCalendarAvailability(datesCtx);
    expect(availability.nonWorkingDays).toEqual([]);
    expect(availability.daysOff).toEqual([]);
    expect([...(availability.openDates ?? [])].sort()).toEqual([
      '2026-11-18',
      '2026-11-20',
      '2026-12-02',
    ]);
  });

  it('is closed by default and ignores days off', () => {
    expect(getIntervalsForDate(datesCtx, '2026-11-19')).toEqual([]);
    // The day off on the 18th does not matter in dates mode.
    expect(getIntervalsForDate(datesCtx, '2026-11-18')).toHaveLength(1);
  });

  it('uses default intervals for plain dates and own intervals for custom ones', () => {
    expect(getIntervalsForDate(datesCtx, '2026-11-18')).toEqual(hoursOf(3, '10:00', '20:00'));
    expect(getIntervalsForDate(datesCtx, '2026-11-20')).toEqual(hoursOf(5, '12:00', '16:00'));
  });

  it('falls back to the default intervals when a non-custom date carries none', () => {
    const ctx: TWorkCalendarContext = {
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '08:00', endTime: '12:00' }],
      workDates: [{ date: '2026-11-18', intervals: [], custom: false }],
    };
    expect(getIntervalsForDate(ctx, '2026-11-18')).toEqual(hoursOf(3, '08:00', '12:00'));
  });

  it('uses the effective intervals of the public context (no custom flag)', () => {
    const ctx: TWorkCalendarContext = {
      scheduleMode: 'dates',
      workDates: [{ date: '2026-11-18', intervals: [{ startTime: '11:00', endTime: '13:00' }] }],
    };
    expect(getIntervalsForDate(ctx, '2026-11-18')).toEqual(hoursOf(3, '11:00', '13:00'));
  });

  it('tolerates a missing workDates field', () => {
    const ctx: TWorkCalendarContext = { scheduleMode: 'dates' };
    expect(getOpenDateSet(ctx).size).toBe(0);
    expect(getUpcomingOpenDates(ctx, 3)).toEqual([]);
    expect(hasOpenDateWithin(ctx, 7)).toBe(false);
  });

  it('lists upcoming open dates from today on, limited to n', () => {
    const today = new Date(2026, 10, 19);
    expect(getUpcomingOpenDates(datesCtx, 2, today)).toEqual(['2026-11-20', '2026-12-02']);
    expect(getUpcomingOpenDates(datesCtx, 1, today)).toEqual(['2026-11-20']);
    expect(getUpcomingOpenDates(datesCtx, 5, new Date(2026, 10, 18))).toHaveLength(3);
  });

  it('checks for an open date within a window that includes today', () => {
    const today = new Date(2026, 10, 19);
    expect(hasOpenDateWithin(datesCtx, 2, today)).toBe(true);
    expect(hasOpenDateWithin(datesCtx, 1, today)).toBe(false);
    expect(hasOpenDateWithin(datesCtx, 1, new Date(2026, 10, 20))).toBe(true);
    expect(hasOpenDateWithin(datesCtx, 7, new Date(2026, 11, 3))).toBe(false);
    expect(hasOpenDateWithin({ ...datesCtx, scheduleMode: 'weekly' }, 7, today)).toBe(false);
  });

  it('counts open dates in a window', () => {
    expect(countOpenDatesWithin(datesCtx, 14, new Date(2026, 10, 18))).toBe(2);
    expect(countOpenDatesWithin(datesCtx, 30, new Date(2026, 10, 18))).toBe(3);
  });
});

describe('admin contexts that include past dates', () => {
  const adminCtx: TWorkCalendarContext = {
    scheduleMode: 'dates',
    defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
    workDates: [
      { date: '2026-11-09', intervals: [], custom: false }, // previous week
      { date: '2026-11-17', intervals: [], custom: false }, // earlier this week
      { date: '2026-11-20', intervals: [], custom: false },
    ],
  };
  const today = new Date(2026, 10, 19);

  it('ignores past dates for upcoming, window checks and counts', () => {
    expect(getUpcomingOpenDates(adminCtx, 5, today)).toEqual(['2026-11-20']);
    expect(hasOpenDateWithin(adminCtx, 1, today)).toBe(false);
    expect(hasOpenDateWithin(adminCtx, 7, today)).toBe(true);
    expect(hasOpenDateWithin(adminCtx, 7, new Date(2026, 10, 21))).toBe(false);
    expect(countOpenDatesWithin(adminCtx, 14, today)).toBe(1);
  });

  it('keeps past open dates in the calendar set so past days still read as working days', () => {
    expect(getCalendarAvailability(adminCtx).openDates?.has('2026-11-09')).toBe(true);
    expect(getIntervalsForDate(adminCtx, '2026-11-17')).toHaveLength(1);
  });
});

describe('weeklyHoursFromIntervals', () => {
  it('repeats the intervals for all seven weekdays', () => {
    const hours = weeklyHoursFromIntervals([{ startTime: '10:00', endTime: '20:00' }]);
    expect(hours).toHaveLength(7);
    expect(new Set(hours.map((h) => h.dayOfWeek)).size).toBe(7);
    expect(getNonWorkingDays(hours)).toEqual([]);
  });
});
