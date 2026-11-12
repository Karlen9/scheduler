import { describe, expect, it } from 'vitest';

import {
  countWorkDateChanges,
  diffWorkDates,
  draftFromWorkDates,
  planAlternatingWeeks,
  planRepeatLastWeek,
  startOfWeekMonday,
} from '../work-days-draft';

import type { TWorkDaysDraft } from '../work-days-draft';

const custom = [{ startTime: '12:00', endTime: '16:00' }];

// Thursday 2026-11-19. Its week is Mon 16 Nov - Sun 22 Nov.
const TODAY = new Date(2026, 10, 19);

function draftOf(entries: [string, typeof custom | null][]): TWorkDaysDraft {
  return new Map(entries);
}

describe('draftFromWorkDates', () => {
  it('keeps custom hours and maps default hours to null', () => {
    const draft = draftFromWorkDates([
      { date: '2026-11-20', intervals: [{ startTime: '10:00', endTime: '20:00' }], custom: false },
      { date: '2026-11-21T00:00:00Z', intervals: custom, custom: true },
    ]);
    expect(draft.get('2026-11-20')).toBeNull();
    expect(draft.get('2026-11-21')).toEqual(custom);
    expect(draftFromWorkDates(undefined).size).toBe(0);
  });
});

describe('diffWorkDates', () => {
  it('is empty when nothing changed', () => {
    const server = draftOf([['2026-11-20', null]]);
    expect(diffWorkDates(server, new Map(server), TODAY)).toEqual({ open: [], close: [] });
    expect(countWorkDateChanges(server, new Map(server), TODAY)).toBe(0);
  });

  it('opens new dates, closes removed ones and sends changed hours', () => {
    const server = draftOf([
      ['2026-11-20', null],
      ['2026-11-21', null],
      ['2026-11-22', custom],
    ]);
    const draft = draftOf([
      ['2026-11-20', custom], // hours changed
      ['2026-11-22', custom], // untouched
      ['2026-11-19', null], // new
    ]);
    expect(diffWorkDates(server, draft, TODAY)).toEqual({
      open: [
        { date: '2026-11-19', intervals: null },
        { date: '2026-11-20', intervals: custom },
      ],
      close: ['2026-11-21'],
    });
    expect(countWorkDateChanges(server, draft, TODAY)).toBe(3);
  });

  it('sends null to restore default hours on a previously custom date', () => {
    const server = draftOf([['2026-11-20', custom]]);
    const draft = draftOf([['2026-11-20', null]]);
    expect(diffWorkDates(server, draft, TODAY)).toEqual({
      open: [{ date: '2026-11-20', intervals: null }],
      close: [],
    });
  });
});

describe('read-only past dates', () => {
  it('never puts past dates into the diff, opened or closed', () => {
    const server = draftOf([
      ['2026-11-16', null], // past, open on the server
      ['2026-11-19', null], // today
    ]);
    const draft = draftOf([
      // 16th removed and 17th added in the draft: both are past and must be ignored.
      ['2026-11-17', null],
      ['2026-11-19', custom],
    ]);
    expect(diffWorkDates(server, draft, TODAY)).toEqual({
      open: [{ date: '2026-11-19', intervals: custom }],
      close: [],
    });
    expect(countWorkDateChanges(server, draft, TODAY)).toBe(1);
  });

  it('has no changes when only past dates differ', () => {
    const server = draftOf([['2026-11-16', null]]);
    expect(countWorkDateChanges(server, new Map(), TODAY)).toBe(0);
  });
});

describe('startOfWeekMonday', () => {
  it('returns the Monday of the week, treating Sunday as the last day', () => {
    expect(startOfWeekMonday(new Date(2026, 10, 19))).toEqual(new Date(2026, 10, 16));
    expect(startOfWeekMonday(new Date(2026, 10, 22))).toEqual(new Date(2026, 10, 16));
    expect(startOfWeekMonday(new Date(2026, 10, 16))).toEqual(new Date(2026, 10, 16));
  });
});

describe('planRepeatLastWeek', () => {
  it('copies the previous week onto the first empty week, keeping hours', () => {
    // Current week (16-22) already has open days -> target is next week (23-29),
    // source is the current week.
    const draft = draftOf([
      ['2026-11-19', null],
      ['2026-11-21', custom],
    ]);
    const plan = planRepeatLastWeek(draft, TODAY);
    expect(plan).toEqual({
      targetWeek: '2026-11-23',
      additions: [
        ['2026-11-26', null],
        ['2026-11-28', custom],
      ],
    });
  });

  it('skips weeks that already contain an open day when picking the target', () => {
    const draft = draftOf([
      ['2026-11-19', null],
      ['2026-11-24', null],
    ]);
    const plan = planRepeatLastWeek(draft, TODAY);
    // Week of 23rd is not empty, so the target is the week of the 30th, copying from the 23rd.
    expect(plan?.targetWeek).toBe('2026-11-30');
    expect(plan?.additions).toEqual([['2026-12-01', null]]);
  });

  it('treats a current week with only past open days as already started', () => {
    const draft = draftOf([['2026-11-17', null]]); // Tuesday, already past
    const plan = planRepeatLastWeek(draft, TODAY);
    // The current week is not an empty target; next week copies it.
    expect(plan?.targetWeek).toBe('2026-11-23');
    expect(plan?.additions).toEqual([['2026-11-24', null]]);
  });

  it('mid-week: Mon/Wed/Fri open this week repeats to next week (past days as source)', () => {
    // Today is Thursday 19th: Mon 16 and Wed 18 are past, Fri 20 is not.
    const draft = draftOf([
      ['2026-11-16', null],
      ['2026-11-18', custom],
      ['2026-11-20', null],
    ]);
    const plan = planRepeatLastWeek(draft, TODAY);
    expect(plan).toEqual({
      targetWeek: '2026-11-23',
      additions: [
        ['2026-11-23', null],
        ['2026-11-25', custom],
        ['2026-11-27', null],
      ],
    });
  });

  it('only fills days that are not in the past when the target is the current week', () => {
    const draft = draftOf([
      ['2026-11-10', null], // Tue of last week
      ['2026-11-12', null], // Thu of last week
    ]);
    const plan = planRepeatLastWeek(draft, TODAY);
    expect(plan?.targetWeek).toBe('2026-11-16');
    // Tue 17th is past, Thu 19th is today.
    expect(plan?.additions).toEqual([['2026-11-19', null]]);
  });

  it('reports nothing to repeat for an empty draft', () => {
    expect(planRepeatLastWeek(new Map(), TODAY)?.additions).toEqual([]);
  });
});

describe('planAlternatingWeeks', () => {
  it('alternates two weekday sets starting from this week', () => {
    const dates = planAlternatingWeeks(new Map(), TODAY, {
      weekA: [1, 3], // Mon, Wed
      weekB: [2], // Tue
      startOffsetWeeks: 0,
      horizonWeeks: 4,
    });
    // Week 0 (16-22, A): Mon 16 and Wed 18 are past -> skipped.
    // Week 1 (23-29, B): Tue 24. Week 2 (30 Nov-6 Dec, A): Mon 30, Wed 2. Week 3 (B): Tue 8.
    expect(dates).toEqual(['2026-11-24', '2026-11-30', '2026-12-02', '2026-12-08']);
  });

  it('starts from next week and never touches dates that are already open', () => {
    const draft = draftOf([['2026-11-23', custom]]);
    const dates = planAlternatingWeeks(draft, TODAY, {
      weekA: [1, 2],
      weekB: [],
      startOffsetWeeks: 1,
      horizonWeeks: 2,
    });
    // Week 0 = 23-29 (A): Mon 23 already open, Tue 24 added. Week 1 (B) is empty.
    expect(dates).toEqual(['2026-11-24']);
  });

  it('returns nothing when both weekday sets are empty', () => {
    expect(
      planAlternatingWeeks(new Map(), TODAY, {
        weekA: [],
        weekB: [],
        startOffsetWeeks: 0,
        horizonWeeks: 8,
      }),
    ).toEqual([]);
  });
});
