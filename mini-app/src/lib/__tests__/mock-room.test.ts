import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api-error';
import { fetchMockAPI } from '../mock-api';
import { getAllBookings } from '../mock-api/queries';
import { MOCK_SCENARIO_STORAGE_KEY, resolveScenario } from '../mock-api/scenario';
import { getState } from '../mock-api/state';

import type {
  TAdminScheduleContext,
  TBooking,
  TRoomResponse,
  TScheduleContext,
  TTimeSlot,
} from '../types';

function setUrl(search: string): void {
  window.history.pushState({}, '', `/test/admin/settings/work-days${search}`);
}

/** Switches scenario through the session storage and rebuilds a pristine state. */
function useScenario(scenario: 'room' | 'default'): void {
  window.sessionStorage.removeItem(MOCK_SCENARIO_STORAGE_KEY);
  setUrl('');
  getState(); // default
  if (scenario === 'room') {
    window.sessionStorage.setItem(MOCK_SCENARIO_STORAGE_KEY, 'room');
    getState(); // rebuilds as room
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfPreviousWeek(): string {
  const d = new Date();
  const since = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - since - 7);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

async function getRoom(): Promise<TRoomResponse> {
  return fetchMockAPI<TRoomResponse>('/api/admin/room');
}

async function put<T>(path: string, body: unknown): Promise<T> {
  return fetchMockAPI<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.removeItem(MOCK_SCENARIO_STORAGE_KEY);
  setUrl('');
});

describe('mock scenario activation', () => {
  beforeEach(() => {
    window.sessionStorage.removeItem(MOCK_SCENARIO_STORAGE_KEY);
    setUrl('');
  });

  it('is the default scenario without a parameter', () => {
    expect(resolveScenario()).toBe('default');
  });

  it('?mock=room activates and persists across navigation without the parameter', () => {
    setUrl('?mock=room');
    expect(resolveScenario()).toBe('room');
    expect(window.sessionStorage.getItem(MOCK_SCENARIO_STORAGE_KEY)).toBe('room');

    window.history.pushState({}, '', '/test/admin/settings');
    expect(resolveScenario()).toBe('room');
  });

  it('?mock=default clears the remembered scenario', () => {
    setUrl('?mock=room');
    resolveScenario();
    setUrl('?mock=default');
    expect(resolveScenario()).toBe('default');
    expect(window.sessionStorage.getItem(MOCK_SCENARIO_STORAGE_KEY)).toBeNull();
    window.history.pushState({}, '', '/test/admin');
    expect(resolveScenario()).toBe('default');
  });

  it('tolerates a failing sessionStorage', () => {
    setUrl('?mock=room');
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(resolveScenario()).toBe('room');
    setUrl('');
    expect(resolveScenario()).toBe('default');
  });

  it('rebuilds the state when the scenario changes', () => {
    useScenario('default');
    const defaultState = getState();
    expect(defaultState.room ?? null).toBeNull();

    window.sessionStorage.setItem(MOCK_SCENARIO_STORAGE_KEY, 'room');
    const roomState = getState();
    expect(roomState).not.toBe(defaultState);
    expect(roomState.room?.name).toBe('Кабинет на Ленина');
    expect(getState()).toBe(roomState);
  });
});

describe('default scenario stays as it was', () => {
  beforeEach(() => useScenario('default'));

  it('has no room and keeps the schedule contexts untouched', async () => {
    expect(await getRoom()).toEqual({ room: null });

    const publicCtx = await fetchMockAPI<Record<string, unknown>>('/api/schedule-context');
    expect(Object.keys(publicCtx).sort()).toEqual(['daysOff', 'workingHours']);
    const adminCtx = await fetchMockAPI<Record<string, unknown>>('/api/admin/schedule-context');
    expect(Object.keys(adminCtx).sort()).toEqual(['daysOff', 'workingHours']);
  });

  it('keeps weekly availability', async () => {
    const slots = await fetchMockAPI<TTimeSlot[]>('/api/availability?date=2026-04-14&duration=45');
    expect(slots.at(0)).toMatchObject({ time: '10:00' });
  });

  it('lets a solo specialist create a room with just themself', async () => {
    const created = await fetchMockAPI<TRoomResponse>('/api/admin/room', {
      method: 'POST',
      body: JSON.stringify({ name: 'Новый' }),
    });
    expect(created.room).toMatchObject({ name: 'Новый', isCreator: true });
    expect(created.members).toHaveLength(1);
    expect(created.members?.[0]).toMatchObject({ isMe: true, linked: true, color: 'green' });

    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    expect(ctx.scheduleMode).toBe('dates');
  });
});

describe('room scenario data', () => {
  beforeEach(() => useScenario('room'));

  it('describes the room, its members and the specialist in dates mode', async () => {
    const data = await getRoom();
    expect(data.room).toMatchObject({ name: 'Кабинет на Ленина', isCreator: true });
    expect(data.members?.map((m) => [m.name, m.color, m.linked, m.isMe])).toEqual([
      ['Карлен Мисакян', 'green', true, true],
      ['Анна Смирнова', 'violet', true, false],
      ['Ольга', 'orange', false, false],
    ]);
    expect(data.meMemberId).toBe(data.members?.[0].id);

    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    expect(ctx.scheduleMode).toBe('dates');
    expect(ctx.defaultIntervals).toEqual([{ startTime: '10:00', endTime: '20:00' }]);

    const notifications = await fetchMockAPI<{ notifyWorkDaysReminder?: boolean }>(
      '/api/admin/notifications',
    );
    expect(notifications.notifyWorkDaysReminder).toBe(true);
  });

  it('gives every day one owner, starts at the previous Monday and leaves free days', async () => {
    const { days = [] } = await getRoom();
    const dates = days.map((d) => d.date);

    expect(new Set(dates).size).toBe(dates.length);
    expect(dates[0] >= mondayOfPreviousWeek()).toBe(true);
    expect(dates.every((d) => d >= mondayOfPreviousWeek())).toBe(true);
    // Sundays are free.
    expect(dates.some((d) => new Date(`${d}T00:00:00`).getDay() === 0)).toBe(false);
    // A few future weekdays are free.
    const owned = new Set(dates);
    const futureFree = [...Array(40).keys()]
      .map((i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
      })
      .filter((d) => d.getDay() !== 0)
      .map(
        (d) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      )
      .filter((d) => !owned.has(d));
    expect(futureFree.length).toBeGreaterThanOrEqual(2);
  });

  it('alternates the weekly pattern between two weeks', async () => {
    const { days = [], members = [] } = await getRoom();
    const me = members[0].id;
    const weekdaysOf = (week: number): number[] =>
      days
        .filter((d) => d.memberId === me)
        .map((d) => new Date(`${d.date}T00:00:00`))
        .filter((d) => {
          const start = new Date(`${mondayOfPreviousWeek()}T00:00:00`);
          return Math.floor((d.getTime() - start.getTime()) / (7 * 86400000)) === week;
        })
        .map((d) => d.getDay());
    expect(weekdaysOf(0)).toEqual([1, 3, 5]); // week A: Mon/Wed/Fri
    expect(weekdaysOf(1)).toEqual([2, 4, 6]); // week B: Tue/Thu/Sat
  });

  it('keeps my room days and my work dates in sync', async () => {
    const { days = [], meMemberId } = await getRoom();
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');

    const myDays = days.filter((d) => d.memberId === meMemberId).map((d) => d.date);
    expect((ctx.workDates ?? []).map((w) => w.date)).toEqual(myDays);

    const custom = (ctx.workDates ?? []).filter((w) => w.custom);
    expect(custom).toHaveLength(1);
    expect(custom[0].intervals).toEqual([{ startTime: '12:00', endTime: '18:00' }]);
  });

  it('keeps bookings only on my days and inside their hours', async () => {
    const { days = [], meMemberId } = await getRoom();
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    const myDays = new Set(days.filter((d) => d.memberId === meMemberId).map((d) => d.date));
    const hoursByDate = new Map((ctx.workDates ?? []).map((w) => [w.date, w.intervals]));

    const bookings = getAllBookings(getState()).filter(
      (b: TBooking) => b.startsAt.slice(0, 10) >= mondayOfPreviousWeek(),
    );
    expect(bookings.length).toBeGreaterThan(10);
    for (const booking of bookings) {
      const date = booking.startsAt.slice(0, 10);
      expect(myDays.has(date), `${booking.id} on ${date}`).toBe(true);
    }
    for (const booking of bookings.filter((b) => ['pending', 'confirmed'].includes(b.status))) {
      const date = booking.startsAt.slice(0, 10);
      const time = booking.startsAt.slice(11, 16);
      const end = booking.endsAt.slice(11, 16);
      const fits = (hoursByDate.get(date) ?? []).some(
        (i) => time >= i.startTime && end <= i.endTime,
      );
      expect(fits, `${booking.id} ${time}-${end} on ${date}`).toBe(true);
    }
    // bookedDates matches the bookings and only covers my days.
    expect((ctx.bookedDates ?? []).every((b) => myDays.has(b.date))).toBe(true);
    expect((ctx.bookedDates ?? []).length).toBeGreaterThan(3);
  });

  it("has one incoming request on a booking-free day of mine and one outgoing on Anna's", async () => {
    const data = await getRoom();
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    const anna = data.members?.[1].id;

    expect(data.requests?.incoming).toHaveLength(1);
    expect(data.requests?.outgoing).toHaveLength(1);
    const incoming = data.requests!.incoming[0];
    expect(incoming.fromMemberId).toBe(anna);
    expect(data.days?.find((d) => d.date === incoming.date)?.memberId).toBe(data.meMemberId);
    expect(incoming.date > todayISO()).toBe(true);
    expect((ctx.bookedDates ?? []).some((b) => b.date === incoming.date)).toBe(false);

    const outgoing = data.requests!.outgoing[0];
    expect(outgoing.toMemberId).toBe(anna);
    expect(data.days?.find((d) => d.date === outgoing.date)?.memberId).toBe(anna);
  });

  it("flags booking presence on my and Anna's days only", async () => {
    const { days = [], members = [] } = await getRoom();
    const [me, anna, olga] = members.map((m) => m.id);
    expect(days.filter((d) => d.memberId === olga).every((d) => d.hasBookings === undefined)).toBe(
      true,
    );
    const annaDays = days.filter((d) => d.memberId === anna);
    const withBookings = annaDays.filter((d) => d.hasBookings).length;
    expect(withBookings / annaDays.length).toBeGreaterThan(0.5);
    expect(
      days.filter((d) => d.memberId === me).every((d) => typeof d.hasBookings === 'boolean'),
    ).toBe(true);
  });
});

describe('room scenario client side', () => {
  beforeEach(() => useScenario('room'));

  it('publishes my open dates from today with effective intervals', async () => {
    const ctx = await fetchMockAPI<TScheduleContext>('/api/schedule-context');
    const room = await getRoom();
    const myFuture = (room.days ?? [])
      .filter((d) => d.memberId === room.meMemberId && d.date >= todayISO())
      .map((d) => d.date);

    expect(ctx.scheduleMode).toBe('dates');
    expect((ctx.workDates ?? []).map((w) => w.date)).toEqual(myFuture);
    expect(ctx.workDates?.every((w) => w.intervals.length > 0)).toBe(true);
  });

  it('returns no slots on closed dates and slots inside the hours on open ones', async () => {
    const room = await getRoom();
    const ctx = await fetchMockAPI<TScheduleContext>('/api/schedule-context');
    const open = new Set((ctx.workDates ?? []).map((w) => w.date));
    const closedFuture = (room.days ?? []).find(
      (d) => d.memberId !== room.meMemberId && d.date > todayISO(),
    )!.date;
    expect(open.has(closedFuture)).toBe(false);
    expect(
      await fetchMockAPI<TTimeSlot[]>(`/api/availability?date=${closedFuture}&duration=60`),
    ).toEqual([]);

    const admin = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    const customDay = (admin.workDates ?? []).find((w) => w.custom && w.date > todayISO())!;
    const slots = await fetchMockAPI<TTimeSlot[]>(
      `/api/availability?date=${customDay.date}&duration=60`,
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.time >= '12:00' && s.endTime! <= '18:00')).toBe(true);

    const plainDay = (ctx.workDates ?? []).find(
      (w) => w.date > todayISO() && w.date !== customDay.date,
    )!;
    const plainSlots = await fetchMockAPI<TTimeSlot[]>(
      `/api/availability?date=${plainDay.date}&duration=60`,
    );
    expect(plainSlots.length).toBeGreaterThan(0);
    expect(plainSlots.every((s) => s.time >= '10:00' && s.endTime! <= '20:00')).toBe(true);
  });
});

describe('room scenario mutations', () => {
  beforeEach(() => useScenario('room'));

  async function futureDayOf(
    owner: 'me' | 'anna' | 'olga',
    withBookings?: boolean,
  ): Promise<string> {
    const room = await getRoom();
    const id = room.members![{ me: 0, anna: 1, olga: 2 }[owner]].id;
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    const booked = new Set((ctx.bookedDates ?? []).map((b) => b.date));
    const day = (room.days ?? []).find(
      (d) =>
        d.memberId === id &&
        d.date > todayISO() &&
        (withBookings === undefined || booked.has(d.date) === withBookings),
    );
    expect(day, `${owner} day`).toBeTruthy();
    return day!.date;
  }

  it("rejects taking a linked colleague's day with the real 409 body", async () => {
    const date = await futureDayOf('anna');
    const room = await getRoom();
    const error = await rejection(
      put('/api/admin/room/days', { assign: [{ date, memberId: room.meMemberId }] }),
    );
    expect(error.status).toBe(409);
    expect(JSON.parse(error.message)).toMatchObject({
      error: 'Error.RoomDayNotYours',
      dates: [date],
    });
  });

  it('forbids assigning a day to a linked colleague (403)', async () => {
    const date = await futureDayOf('olga');
    const room = await getRoom();
    const error = await rejection(
      put('/api/admin/room/days', { assign: [{ date, memberId: room.members![1].id }] }),
    );
    expect(error.status).toBe(403);
    expect(JSON.parse(error.message).error).toBe('Error.RoomForbidden');
  });

  it('refuses to give away a day with bookings and changes nothing', async () => {
    const date = await futureDayOf('me', true);
    const olgaDay = await futureDayOf('olga');
    const room = await getRoom();
    const before = JSON.stringify(room.days);
    const error = await rejection(
      put('/api/admin/room/days', {
        assign: [
          { date: olgaDay, memberId: room.meMemberId },
          { date, memberId: '' },
        ],
      }),
    );
    expect(error.status).toBe(409);
    expect(JSON.parse(error.message)).toMatchObject({
      error: 'Error.WorkDateHasBookings',
      dates: [date],
    });
    expect(JSON.stringify((await getRoom()).days)).toBe(before);
  });

  it('rejects past dates', async () => {
    const error = await rejection(
      put('/api/admin/room/days', { assign: [{ date: '2000-01-01', memberId: '' }] }),
    );
    expect(error.status).toBe(400);
  });

  it("assigns an offline colleague's day to me and keeps the work dates in sync", async () => {
    const date = await futureDayOf('olga');
    const room = await getRoom();
    const result = await put<TRoomResponse>('/api/admin/room/days', {
      assign: [{ date, memberId: room.meMemberId }],
    });
    expect(result.days?.find((d) => d.date === date)?.memberId).toBe(room.meMemberId);
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    expect(ctx.workDates?.some((w) => w.date === date)).toBe(true);

    await put('/api/admin/room/days', { assign: [{ date, memberId: '' }] });
    const after = await getRoom();
    expect(after.days?.some((d) => d.date === date)).toBe(false);
    const ctxAfter = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    expect(ctxAfter.workDates?.some((w) => w.date === date)).toBe(false);
  });

  it("refuses to open a colleague's day or close a day with bookings via work-dates", async () => {
    const annaDay = await futureDayOf('anna');
    const taken = await rejection(
      put('/api/admin/work-dates', { open: [{ date: annaDay, intervals: null }], close: [] }),
    );
    expect(taken.status).toBe(409);
    expect(JSON.parse(taken.message)).toMatchObject({
      error: 'Error.RoomDayTaken',
      dates: [annaDay],
    });

    const bookedDay = await futureDayOf('me', true);
    const booked = await rejection(put('/api/admin/work-dates', { open: [], close: [bookedDay] }));
    expect(JSON.parse(booked.message).error).toBe('Error.WorkDateHasBookings');
  });

  it('claims a free day when opened through work-dates', async () => {
    const room = await getRoom();
    const owned = new Set((room.days ?? []).map((d) => d.date));
    const free = [...Array(30).keys()]
      .map((i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
      .find((d) => !owned.has(d))!;
    await put('/api/admin/work-dates', { open: [{ date: free, intervals: null }], close: [] });
    expect((await getRoom()).days?.find((d) => d.date === free)?.memberId).toBe(room.meMemberId);
  });

  it('accepts the incoming request (the day moves to Anna) and declines others', async () => {
    const room = await getRoom();
    const request = room.requests!.incoming[0];
    await fetchMockAPI(`/api/admin/room/requests/${request.id}/accept`, { method: 'POST' });

    const after = await getRoom();
    expect(after.requests?.incoming).toHaveLength(0);
    expect(after.days?.find((d) => d.date === request.date)?.memberId).toBe(room.members![1].id);
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    expect(ctx.workDates?.some((w) => w.date === request.date)).toBe(false);
  });

  it("creates and cancels a request for a linked colleague's day", async () => {
    const date = await futureDayOf('anna');
    const room = await getRoom();
    const existing = room.requests!.outgoing.map((r) => r.date);
    const target = (await getRoom()).days!.find(
      (d) =>
        d.memberId === room.members![1].id && d.date > todayISO() && !existing.includes(d.date),
    )!.date;
    expect(date).toBeTruthy();

    const created = await fetchMockAPI<{ id: string }>('/api/admin/room/requests', {
      method: 'POST',
      body: JSON.stringify({ date: target }),
    });
    expect((await getRoom()).requests?.outgoing.some((r) => r.id === created.id)).toBe(true);
    await fetchMockAPI(`/api/admin/room/requests/${created.id}`, { method: 'DELETE' });
    expect((await getRoom()).requests?.outgoing.some((r) => r.id === created.id)).toBe(false);

    const olgaDay = await futureDayOf('olga');
    const error = await rejection(
      fetchMockAPI('/api/admin/room/requests', {
        method: 'POST',
        body: JSON.stringify({ date: olgaDay }),
      }),
    );
    expect(error.status).toBe(409);
  });

  it('adds offline members with invite links, enforces the limit and removes them', async () => {
    const added = await fetchMockAPI<{ member: { id: string }; inviteLink?: string }>(
      '/api/admin/room/members',
      { method: 'POST', body: JSON.stringify({ name: 'Олег', color: 'blue', invite: true }) },
    );
    expect(added.inviteLink).toMatch(/^https:\/\/t\.me\/schedu1erbot\?start=room_[0-9a-f]{16}$/);

    for (const color of ['pink', 'teal']) {
      await fetchMockAPI('/api/admin/room/members', {
        method: 'POST',
        body: JSON.stringify({ name: `X ${color}`, color, invite: false }),
      });
    }
    const full = await rejection(
      fetchMockAPI('/api/admin/room/members', {
        method: 'POST',
        body: JSON.stringify({ name: 'Лишний', color: 'green', invite: false }),
      }),
    );
    expect(full.status).toBe(409);

    await fetchMockAPI(`/api/admin/room/members/${added.member.id}`, { method: 'DELETE' });
    expect((await getRoom()).members?.some((m) => m.id === added.member.id)).toBe(false);
  });

  it('frees the days of a deleted offline member and keeps linked names read-only', async () => {
    const room = await getRoom();
    const olga = room.members![2].id;
    const anna = room.members![1].id;
    await fetchMockAPI(`/api/admin/room/members/${olga}`, { method: 'DELETE' });
    expect((await getRoom()).days?.some((d) => d.memberId === olga)).toBe(false);

    const error = await rejection(put(`/api/admin/room/members/${anna}`, { name: 'Другое' }));
    expect(error.status).toBe(403);
    const colour = await put<{ color: string }>(`/api/admin/room/members/${room.meMemberId}`, {
      color: 'pink',
    });
    expect(colour.color).toBe('pink');
  });

  it('refuses weekly mode while in a room and allows it after leaving', async () => {
    const refused = await rejection(
      put('/api/admin/schedule-settings', { scheduleMode: 'weekly', defaultIntervals: [] }),
    );
    expect(refused.status).toBe(409);
    expect(refused.message).toContain('кабинете');

    const room = await getRoom();
    await fetchMockAPI(`/api/admin/room/members/${room.meMemberId}`, { method: 'DELETE' });
    expect(await getRoom()).toEqual({ room: null });
    // My work dates stay.
    const ctx = await fetchMockAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    expect((ctx.workDates ?? []).length).toBeGreaterThan(0);

    const result = await put<{ scheduleMode: string }>('/api/admin/schedule-settings', {
      scheduleMode: 'weekly',
      defaultIntervals: [],
    });
    expect(result.scheduleMode).toBe('weekly');
  });
});
