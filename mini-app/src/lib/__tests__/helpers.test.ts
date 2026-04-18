import { describe, expect, it } from 'vitest';

import { generateTimeSlotsForDay, nextDateForWeekday, parseDateParam } from '../helpers';

describe('generateTimeSlotsForDay', () => {
  it('merges and sorts slots from multiple intervals on the same day', () => {
    const slots = generateTimeSlotsForDay(
      [
        { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      ],
      1,
      60,
    );

    expect(slots).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
  });

  it('deduplicates slots if intervals overlap in stored data', () => {
    const slots = generateTimeSlotsForDay(
      [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 1, startTime: '11:00', endTime: '13:00' },
      ],
      1,
      60,
    );

    expect(slots).toEqual(['09:00', '10:00', '11:00', '12:00']);
  });

  it('divides the day by the selected duration', () => {
    const slots = generateTimeSlotsForDay(
      [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }],
      1,
      45,
    );

    expect(slots).toEqual(['09:00', '09:45', '10:30', '11:15']);
  });
});

describe('parseDateParam', () => {
  it('returns undefined for null', () => {
    expect(parseDateParam(null)).toBeUndefined();
  });

  it('returns undefined for malformed input', () => {
    expect(parseDateParam('2026-4-1')).toBeUndefined();
    expect(parseDateParam('not-a-date')).toBeUndefined();
    expect(parseDateParam('')).toBeUndefined();
  });

  it('returns undefined when the date overflows (e.g. Feb 31)', () => {
    expect(parseDateParam('2026-02-31')).toBeUndefined();
  });

  it('parses a valid YYYY-MM-DD into a local Date', () => {
    const d = parseDateParam('2026-04-18');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(18);
  });
});

describe('nextDateForWeekday', () => {
  it('returns today when targetDay equals today.getDay()', () => {
    const today = new Date(2026, 3, 18); // Saturday
    const result = nextDateForWeekday(today.getDay(), today);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(18);
  });

  it('returns the next occurrence within 1-6 days for a future weekday', () => {
    const today = new Date(2026, 3, 18); // Saturday, getDay() = 6
    const result = nextDateForWeekday(1, today); // Monday
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(20);
  });

  it('handles wrap-around across month boundaries', () => {
    const today = new Date(2026, 3, 30); // Thursday Apr 30, getDay() = 4
    const result = nextDateForWeekday(1, today); // Monday
    expect(result.getDay()).toBe(1);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(4);
  });

  it('normalizes the returned time to midnight', () => {
    const today = new Date(2026, 3, 18, 15, 30, 45);
    const result = nextDateForWeekday(2, today);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});
