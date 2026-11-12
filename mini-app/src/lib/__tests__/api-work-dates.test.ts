import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api';
import { ApiError, WorkDatesConflictError } from '../api-error';

vi.mock('../telegram', () => ({
  getInitData: () => 'init',
  getSpecialistId: () => 'spec-1',
  waitForInitData: async () => Promise.resolve('init'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function ok(body: unknown): unknown {
  return { ok: true, status: 200, json: async () => Promise.resolve(body) };
}

function fail(status: number, text: string): unknown {
  return { ok: false, status, text: async () => Promise.resolve(text) };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('api.admin.updateScheduleSettings', () => {
  it('PUTs the mode and default intervals and normalizes 24:00', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        scheduleMode: 'dates',
        defaultIntervals: [{ startTime: '10:00', endTime: '24:00' }],
        autoOpened: 2,
      }),
    );

    const result = await api.admin.updateScheduleSettings({
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '10:00', endTime: '00:00' }],
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/schedule-settings');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '10:00', endTime: '24:00' }],
    });
    expect(result.autoOpened).toBe(2);
    expect(result.defaultIntervals).toEqual([{ startTime: '10:00', endTime: '00:00' }]);
  });
});

describe('api.admin.updateWorkDates', () => {
  it('PUTs the open/close diff and returns the admin work dates', async () => {
    mockFetch.mockResolvedValueOnce(
      ok([
        {
          date: '2026-11-20',
          intervals: [{ startTime: '10:00', endTime: '20:00' }],
          custom: false,
        },
      ]),
    );

    const result = await api.admin.updateWorkDates({
      open: [
        { date: '2026-11-20', intervals: null },
        { date: '2026-11-21', intervals: [{ startTime: '12:00', endTime: '16:00' }] },
      ],
      close: ['2026-11-22'],
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/work-dates');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      open: [
        { date: '2026-11-20', intervals: null },
        { date: '2026-11-21', intervals: [{ startTime: '12:00', endTime: '16:00' }] },
      ],
      close: ['2026-11-22'],
    });
    expect(result[0].date).toBe('2026-11-20');
  });

  it('surfaces the conflicting dates of a 409', async () => {
    mockFetch.mockResolvedValueOnce(
      fail(409, JSON.stringify({ error: 'x', message: 'Has bookings', dates: ['2026-11-22'] })),
    );

    const error = await api.admin
      .updateWorkDates({ open: [], close: ['2026-11-22'] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkDatesConflictError);
    expect((error as WorkDatesConflictError).dates).toEqual(['2026-11-22']);
    expect((error as WorkDatesConflictError).status).toBe(409);
    expect((error as WorkDatesConflictError).message).toBe('Has bookings');
  });

  it('still throws a conflict error when the 409 body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(fail(409, 'plain text'));

    const error = await api.admin
      .updateWorkDates({ open: [], close: ['2026-11-22'] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkDatesConflictError);
    expect((error as WorkDatesConflictError).dates).toEqual([]);
  });

  it('rethrows other errors untouched', async () => {
    mockFetch.mockResolvedValueOnce(fail(400, 'bad date'));

    const error = await api.admin
      .updateWorkDates({ open: [{ date: 'x', intervals: null }], close: [] })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(WorkDatesConflictError);
    expect((error as ApiError).status).toBe(400);
  });
});

describe('schedule contexts', () => {
  it('normalizes work date intervals in the public context and keeps weekly data intact', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '24:00' }],
        daysOff: [],
        scheduleMode: 'dates',
        workDates: [{ date: '2026-11-20', intervals: [{ startTime: '10:00', endTime: '24:00' }] }],
      }),
    );

    const ctx = await api.getScheduleContext();
    expect(ctx.workingHours[0].endTime).toBe('00:00');
    expect(ctx.workDates?.[0].intervals[0].endTime).toBe('00:00');
  });

  it('leaves the new fields absent when the backend does not send them', async () => {
    mockFetch.mockResolvedValueOnce(ok({ workingHours: [], daysOff: [] }));

    const ctx = await api.getScheduleContext();
    expect(ctx.scheduleMode).toBeUndefined();
    expect(ctx.workDates).toBeUndefined();
  });

  it('normalizes default intervals and work dates in the admin context', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        workingHours: [],
        daysOff: [],
        scheduleMode: 'dates',
        defaultIntervals: [{ startTime: '10:00', endTime: '24:00' }],
        workDates: [{ date: '2026-11-20', intervals: [], custom: false }],
      }),
    );

    const ctx = await api.admin.getScheduleContext();
    expect(ctx.defaultIntervals?.[0].endTime).toBe('00:00');
    expect(ctx.workDates?.[0].custom).toBe(false);
  });
});
