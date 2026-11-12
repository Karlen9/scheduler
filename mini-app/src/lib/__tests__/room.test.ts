import { describe, expect, it } from 'vitest';

import {
  ROOM_COLORS,
  buildBookingCounts,
  buildOwnerMap,
  buildScheduleLines,
  effectiveOwner,
  firstUnusedColor,
  overridesToAssignments,
  planRoomAlternatingWeeks,
  planRoomRepeatLastWeek,
  roomColorVar,
  scheduleMonthSpan,
  setOverride,
} from '../room';

// Thursday 2026-11-19; its week is Mon 16 - Sun 22 Nov.
const TODAY = new Date(2026, 10, 19);

function ownersOf(entries: [string, string][]): Map<string, string> {
  return new Map(entries);
}

describe('room colours', () => {
  it('maps palette keys to theme tokens and falls back to green', () => {
    expect(roomColorVar('violet')).toBe('var(--room-violet)');
    expect(roomColorVar('nope')).toBe('var(--room-green)');
    expect(roomColorVar(undefined)).toBe('var(--room-green)');
  });

  it('preselects the first colour nobody uses', () => {
    expect(firstUnusedColor([])).toBe('green');
    expect(firstUnusedColor([{ id: 'a', name: 'A', color: 'green' }])).toBe('violet');
    expect(
      firstUnusedColor(ROOM_COLORS.map((color, i) => ({ id: String(i), name: 'x', color }))),
    ).toBe('green');
  });
});

describe('assignment overrides', () => {
  const server = ownersOf([
    ['2026-11-20', 'me'],
    ['2026-11-21', 'anna'],
  ]);

  it('reads the server owner unless overridden, "" meaning free', () => {
    const overrides = new Map([['2026-11-20', '']]);
    expect(effectiveOwner(server, overrides, '2026-11-20')).toBe('');
    expect(effectiveOwner(server, overrides, '2026-11-21')).toBe('anna');
    expect(effectiveOwner(server, overrides, '2026-11-25')).toBe('');
  });

  it('drops an override that equals the server state', () => {
    let overrides = setOverride(server, new Map(), '2026-11-20', 'boris');
    expect(overrides.get('2026-11-20')).toBe('boris');
    overrides = setOverride(server, overrides, '2026-11-20', 'me');
    expect(overrides.size).toBe(0);
    overrides = setOverride(server, overrides, '2026-11-25', '');
    expect(overrides.size).toBe(0);
  });

  it('builds a sorted assignment payload without past dates', () => {
    const overrides = new Map([
      ['2026-11-25', 'me'],
      ['2026-11-18', 'me'], // past
      ['2026-11-20', ''],
    ]);
    expect(overridesToAssignments(overrides, TODAY)).toEqual([
      { date: '2026-11-20', memberId: '' },
      { date: '2026-11-25', memberId: 'me' },
    ]);
  });

  it('builds the owner map from room days', () => {
    expect(
      buildOwnerMap([{ date: '2026-11-20T00:00:00Z', memberId: 'me' }]).get('2026-11-20'),
    ).toBe('me');
    expect(buildOwnerMap(undefined).size).toBe(0);
  });
});

describe('planRoomRepeatLastWeek', () => {
  const assignable = new Set(['me', 'boris']);

  it('copies my and offline days of the previous week onto free days only', () => {
    const owners = ownersOf([
      ['2026-11-16', 'me'], // Mon (past)
      ['2026-11-18', 'boris'], // Wed (past)
      ['2026-11-20', 'anna'], // Fri, a linked colleague
    ]);
    const plan = planRoomRepeatLastWeek(owners, assignable, TODAY);
    // Current week already has days of mine, so the target is next week (23-29).
    expect(plan?.targetWeek).toBe('2026-11-23');
    // Fri belongs to a linked colleague in the source week: it is not copied.
    expect(plan?.additions).toEqual([
      ['2026-11-23', 'me'],
      ['2026-11-25', 'boris'],
    ]);
  });

  it('never overwrites an occupied day of the target week', () => {
    const owners = ownersOf([
      ['2026-11-16', 'me'],
      ['2026-11-18', 'me'],
      ['2026-11-23', 'anna'], // a colleague already holds next Monday
    ]);
    const plan = planRoomRepeatLastWeek(owners, assignable, TODAY);
    expect(plan?.targetWeek).toBe('2026-11-23');
    expect(plan?.additions).toEqual([['2026-11-25', 'me']]);
  });

  it('returns nothing to copy for an empty room', () => {
    expect(planRoomRepeatLastWeek(new Map(), assignable, TODAY)?.additions).toEqual([]);
  });
});

describe('planRoomAlternatingWeeks', () => {
  it('assigns only free days or days of assignable members, never a linked colleague', () => {
    const owners = ownersOf([
      ['2026-11-24', 'anna'], // linked colleague, Tuesday of week B
      ['2026-11-30', 'boris'], // offline, Monday of week A: may be re-assigned
    ]);
    const plan = planRoomAlternatingWeeks(owners, ['me', 'boris'], TODAY, {
      weekA: { me: [1], boris: [] },
      weekB: { me: [2] },
      startOffsetWeeks: 0,
      horizonWeeks: 4,
    });
    // Week 0 (A): Mon 16 is past. Week 1 (B): Tue 24 is a linked colleague's -> skipped.
    // Week 2 (A): Mon 30 goes from boris to me. Week 3 (B): Tue 8 Dec.
    expect(plan).toEqual([
      ['2026-11-30', 'me'],
      ['2026-12-08', 'me'],
    ]);
  });

  it('lets the first member in order win a shared weekday', () => {
    const plan = planRoomAlternatingWeeks(new Map(), ['me', 'boris'], TODAY, {
      weekA: { me: [5], boris: [5] },
      weekB: {},
      startOffsetWeeks: 1,
      horizonWeeks: 1,
    });
    expect(plan).toEqual([['2026-11-27', 'me']]);
  });

  it('skips days already owned by the chosen member', () => {
    const plan = planRoomAlternatingWeeks(ownersOf([['2026-11-23', 'me']]), ['me'], TODAY, {
      weekA: { me: [1] },
      weekB: {},
      startOffsetWeeks: 1,
      horizonWeeks: 1,
    });
    expect(plan).toEqual([]);
  });
});

describe('shareable schedule', () => {
  const members = [
    { id: 'anna', name: 'Аня' },
    { id: 'boris', name: 'Борис' },
    { id: 'me', name: 'Вера' },
  ];
  const short = (m: number): string =>
    ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][m];

  it('groups dates per member and month, in member order', () => {
    const owners = ownersOf([
      ['2026-11-19', 'anna'],
      ['2026-11-24', 'anna'],
      ['2026-12-02', 'anna'],
      ['2026-11-20', 'boris'],
      ['2026-11-18', 'me'], // before today: not listed
      ['2027-02-01', 'me'], // beyond the 28-day window
    ]);
    expect(buildScheduleLines(owners, members, TODAY, 28, short)).toEqual([
      'Аня — 19, 24 ноя 2 дек',
      'Борис — 20 ноя',
    ]);
  });

  it('names one or two months for the header', () => {
    const nom = (m: number): string =>
      ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноябрь', 'декабрь'][
        m
      ];
    expect(scheduleMonthSpan(new Date(2026, 10, 1), 7, nom)).toBe('ноябрь');
    expect(scheduleMonthSpan(TODAY, 28, nom)).toBe('ноябрь–декабрь');
  });
});

describe('buildBookingCounts', () => {
  it('merges bookedDates and workDates counts and drops zeros', () => {
    const counts = buildBookingCounts({
      bookedDates: [
        { date: '2026-11-20', bookingCount: 2 },
        { date: '2026-11-21', bookingCount: 0 },
      ],
      workDates: [
        { date: '2026-11-20', bookingCount: 1 },
        { date: '2026-11-22', bookingCount: 3 },
        { date: '2026-11-23' },
      ],
    });
    expect(Object.fromEntries(counts)).toEqual({ '2026-11-20': 2, '2026-11-22': 3 });
    expect(buildBookingCounts(null).size).toBe(0);
  });
});
