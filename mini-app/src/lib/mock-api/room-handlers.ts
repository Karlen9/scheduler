import { ApiError } from '../api-error';
import { ROOM_COLORS } from '../room';
import { getAllBookings, getAvailableSlots } from './queries';
import { bumpChangeVersions } from './state';
import { clone, dateString, formatDateISO, getString } from './utils';

import type {
  TAdminWorkDate,
  TRoomDay,
  TRoomMember,
  TRoomResponse,
  TTimeSlot,
  TWorkingHours,
  TWorkingInterval,
} from '../types';
import type { TMockRoom } from './room-types';
import type { TMockState } from './types';

const DEFAULT_INTERVALS: TWorkingInterval[] = [{ startTime: '10:00', endTime: '20:00' }];
const ACTIVE_STATUSES = ['pending', 'confirmed'];
const MAX_MEMBERS = 6;

/** A handled request: `value` is the response body (possibly undefined for 204-style answers). */
export type TRoomHandled = { value: unknown };

function fail(status: number, error: string, message: string, dates: string[] = []): never {
  throw new ApiError(JSON.stringify({ error, message, dates }), status);
}

function prepare(state: TMockState): void {
  state.scheduleMode ??= 'weekly';
  state.defaultIntervals ??= DEFAULT_INTERVALS.map((i) => ({ ...i }));
  state.workDates ??= new Map();
  state.room ??= null;
}

function todayISO(): string {
  return dateString(0);
}

/** Monday of the previous week (YYYY-MM-DD): the start of the admin `workDates` window. */
function windowStartISO(): string {
  const today = new Date();
  const sinceMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  return formatDateISO(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday - 7),
  );
}

/** Active-booking counts per date, for dates from the start of the window on. */
export function activeBookingCounts(state: TMockState): Map<string, number> {
  const from = windowStartISO();
  const counts = new Map<string, number>();
  for (const booking of getAllBookings(state)) {
    const date = booking.startsAt.slice(0, 10);
    if (date >= from && ACTIVE_STATUSES.includes(booking.status)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }
  return counts;
}

function effectiveIntervals(state: TMockState, date: string): TWorkingInterval[] {
  const own = state.workDates?.get(date);
  return (own?.length ? own : state.defaultIntervals) ?? DEFAULT_INTERVALS;
}

function adminWorkDates(state: TMockState): TAdminWorkDate[] {
  const from = windowStartISO();
  const counts = activeBookingCounts(state);
  return [...(state.workDates ?? [])]
    .filter(([date]) => date >= from)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, own]) => ({
      date,
      intervals: clone(effectiveIntervals(state, date)),
      custom: Boolean(own?.length),
      bookingCount: counts.get(date) ?? 0,
    }));
}

function adminScheduleContext(state: TMockState): unknown {
  const counts = activeBookingCounts(state);
  return clone({
    workingHours: state.workingHours,
    daysOff: state.daysOff,
    scheduleMode: state.scheduleMode,
    defaultIntervals: state.defaultIntervals,
    workDates: adminWorkDates(state),
    bookedDates: [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bookingCount]) => ({ date, bookingCount })),
  });
}

function publicScheduleContext(state: TMockState): unknown {
  const today = todayISO();
  return clone({
    workingHours: state.workingHours,
    daysOff: [],
    scheduleMode: 'dates',
    workDates: [...(state.workDates ?? [])]
      .filter(([date]) => date >= today)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date]) => ({ date, intervals: effectiveIntervals(state, date) })),
  });
}

function datesAvailability(state: TMockState, endpoint: string): TTimeSlot[] {
  const date = new URLSearchParams(endpoint.split('?')[1] ?? '').get('date') ?? '';
  if (!state.workDates?.has(date)) {
    return [];
  }
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const workingHours: TWorkingHours[] = effectiveIntervals(state, date).map((i) => ({
    dayOfWeek,
    startTime: i.startTime,
    endTime: i.endTime,
  }));
  return getAvailableSlots({ ...state, workingHours, daysOff: [] }, endpoint);
}

function requireRoom(state: TMockState): TMockRoom {
  if (!state.room) {
    fail(404, 'Error.RoomNotFound', 'Вы не состоите в кабинете');
  }
  return state.room;
}

function memberOf(room: TMockRoom, id: string): TRoomMember | undefined {
  return room.members.find((m) => m.id === id);
}

/** Room payload of `GET /api/admin/room` (`{room: null}` when working alone). */
export function buildRoomPayload(state: TMockState): TRoomResponse {
  const room = state.room;
  if (!room) {
    return { room: null };
  }
  const from = windowStartISO();
  const counts = activeBookingCounts(state);
  const days: TRoomDay[] = [...room.owners]
    .filter(([date]) => date >= from)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, memberId]) => {
      const day: TRoomDay = { date, memberId };
      if (memberId === room.meMemberId) {
        day.hasBookings = (counts.get(date) ?? 0) > 0;
      } else if (memberOf(room, memberId)?.linked) {
        day.hasBookings = room.colleagueBookingDates.has(date);
      }
      return day;
    });
  return clone({
    room: { id: room.id, name: room.name, isCreator: room.isCreator },
    meMemberId: room.meMemberId,
    members: room.members.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      linked: Boolean(m.linked),
      isMe: m.id === room.meMemberId,
      hasInvite: Boolean(m.hasInvite),
    })),
    days,
    requests: {
      incoming: room.incoming.map((r) => ({ id: r.id, date: r.date, fromMemberId: r.memberId })),
      outgoing: room.outgoing.map((r) => ({ id: r.id, date: r.date, toMemberId: r.memberId })),
    },
  });
}

function cancelRequestsFor(room: TMockRoom, date: string): void {
  room.incoming = room.incoming.filter((r) => r.date !== date);
  room.outgoing = room.outgoing.filter((r) => r.date !== date);
}

function bump(state: TMockState): void {
  bumpChangeVersions(state, ['room', 'workingHours']);
}

function inviteLink(code: string): string {
  return `https://t.me/schedu1erbot?start=room_${code}`;
}

function randomCode(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function assertFutureDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail(400, 'Error.BadDate', 'Неверный формат даты');
  }
  if (date < todayISO()) {
    fail(400, 'Error.WorkDatePast', 'Нельзя менять прошедшие дни');
  }
}

/***************************************************************************************************
 * PUT /api/admin/room/days. Rules of the real API, all-or-nothing: only me, an offline colleague
 * or nobody may be assigned (assigning a linked colleague is forbidden), a day of a linked
 * colleague is not mine to move (409), and a day of mine that has bookings cannot be given away.
 ***************************************************************************************************/
function assignDays(state: TMockState, body: Record<string, unknown>): void {
  const room = requireRoom(state);
  const assigns = (Array.isArray(body.assign) ? body.assign : []) as {
    date?: unknown;
    memberId?: unknown;
  }[];
  const counts = activeBookingCounts(state);
  const notYours: string[] = [];
  const hasBookings: string[] = [];

  for (const item of assigns) {
    const date = getString(item.date);
    const target = getString(item.memberId);
    assertFutureDate(date);
    if (target !== '') {
      const member = memberOf(room, target);
      if (!member) {
        fail(404, 'Error.RoomMemberNotFound', 'Участник не найден');
      }
      if (member.linked && target !== room.meMemberId) {
        fail(403, 'Error.RoomForbidden', 'Нельзя назначать дни другим подключённым участникам');
      }
    }
    const owner = room.owners.get(date) ?? '';
    if (owner !== '' && owner !== room.meMemberId && memberOf(room, owner)?.linked) {
      notYours.push(date);
    } else if (owner === room.meMemberId && target !== owner && (counts.get(date) ?? 0) > 0) {
      hasBookings.push(date);
    }
  }
  if (notYours.length > 0) {
    fail(409, 'Error.RoomDayNotYours', 'Этот день принадлежит коллеге', notYours);
  }
  if (hasBookings.length > 0) {
    fail(409, 'Error.WorkDateHasBookings', 'На эти дни есть записи', hasBookings);
  }

  for (const item of assigns) {
    const date = getString(item.date);
    const target = getString(item.memberId);
    if (target === '') {
      room.owners.delete(date);
      state.workDates?.delete(date);
    } else {
      room.owners.set(date, target);
      if (target === room.meMemberId) {
        state.workDates?.set(date, state.workDates.get(date) ?? null);
      } else {
        state.workDates?.delete(date);
      }
    }
    cancelRequestsFor(room, date);
  }
}

function handleRoomRoutes(
  state: TMockState,
  method: string,
  path: string,
  body: Record<string, unknown>,
): TRoomHandled | undefined {
  if (path === '/api/admin/room') {
    if (method === 'GET') {
      return { value: buildRoomPayload(state) };
    }
    if (method === 'POST') {
      if (state.room) {
        fail(409, 'Error.AlreadyInRoom', 'Вы уже состоите в кабинете');
      }
      const me = state.adminProfile;
      const workDates = state.workDates ?? new Map();
      state.scheduleMode = 'dates';
      if (!state.defaultIntervals?.length) {
        state.defaultIntervals = DEFAULT_INTERVALS.map((i) => ({ ...i }));
      }
      state.room = {
        id: `mock-room-${Date.now()}`,
        name: getString(body.name).trim(),
        isCreator: true,
        meMemberId: 'mock-member-me',
        members: Array.of<TRoomMember>({
          id: 'mock-member-me',
          name: me.name,
          color: 'green',
          linked: true,
          isMe: true,
        }),
        owners: new Map([...workDates.keys()].map((date) => [date, 'mock-member-me'])),
        colleagueBookingDates: new Set(),
        invites: new Map(),
        incoming: [],
        outgoing: [],
      };
      bump(state);
      return { value: buildRoomPayload(state) };
    }
    if (method === 'PUT') {
      requireRoom(state).name = getString(body.name).trim();
      bump(state);
      return { value: buildRoomPayload(state) };
    }
    return undefined;
  }

  if (path === '/api/admin/room/members' && method === 'POST') {
    const room = requireRoom(state);
    const name = getString(body.name).trim();
    const color = getString(body.color);
    if (!name || !ROOM_COLORS.includes(color as never)) {
      fail(400, 'Error.BadRequest', 'Укажите имя и цвет участника');
    }
    if (room.members.length >= MAX_MEMBERS) {
      fail(409, 'Error.RoomFull', 'В кабинете не больше 6 участников');
    }
    const invite = body.invite === true;
    const member: TRoomMember = {
      id: `mock-member-${Date.now()}-${room.members.length}`,
      name,
      color,
      linked: false,
      hasInvite: invite,
    };
    room.members.push(member);
    let link: string | undefined;
    if (invite) {
      const code = randomCode();
      room.invites.set(member.id, code);
      link = inviteLink(code);
    }
    bump(state);
    return { value: clone({ member, ...(link ? { inviteLink: link } : {}) }) };
  }

  const memberMatch = path.match(/^\/api\/admin\/room\/members\/([^/]+)(\/invite)?$/);
  if (memberMatch) {
    const room = requireRoom(state);
    const member = memberOf(room, memberMatch[1]);
    if (!member) {
      fail(404, 'Error.RoomMemberNotFound', 'Участник не найден');
    }
    const isMe = member.id === room.meMemberId;

    if (memberMatch[2] && method === 'POST') {
      if (member.linked) {
        fail(403, 'Error.RoomForbidden', 'Приглашать можно только коллегу без бота');
      }
      const code = randomCode();
      room.invites.set(member.id, code);
      member.hasInvite = true;
      bump(state);
      return { value: { inviteLink: inviteLink(code) } };
    }

    if (method === 'PUT') {
      const name = typeof body.name === 'string' ? body.name.trim() : undefined;
      const color = typeof body.color === 'string' ? body.color : undefined;
      if (name !== undefined && member.linked) {
        fail(403, 'Error.RoomForbidden', 'Имя подключённого участника меняет только он сам');
      }
      if (color !== undefined && member.linked && !isMe) {
        fail(403, 'Error.RoomForbidden', 'Цвет подключённого участника меняет только он сам');
      }
      if (color !== undefined && !ROOM_COLORS.includes(color as never)) {
        fail(400, 'Error.BadRequest', 'Неизвестный цвет');
      }
      if (name) {
        member.name = name;
      }
      if (color) {
        member.color = color;
      }
      bump(state);
      return { value: clone(member) };
    }

    if (method === 'DELETE') {
      if (isMe) {
        // Leaving: my work days stay in my own schedule, the room is gone for me.
        state.room = null;
      } else {
        if (member.linked && !room.isCreator) {
          fail(403, 'Error.RoomForbidden', 'Исключать участников может только создатель кабинета');
        }
        room.members = room.members.filter((m) => m.id !== member.id);
        for (const [date, owner] of [...room.owners]) {
          if (owner === member.id) {
            room.owners.delete(date);
          }
        }
        room.incoming = room.incoming.filter((r) => r.memberId !== member.id);
        room.outgoing = room.outgoing.filter((r) => r.memberId !== member.id);
        room.invites.delete(member.id);
      }
      bump(state);
      return { value: undefined };
    }
    return undefined;
  }

  if (path === '/api/admin/room/days' && method === 'PUT') {
    assignDays(state, body);
    bump(state);
    return { value: buildRoomPayload(state) };
  }

  if (path === '/api/admin/room/requests' && method === 'POST') {
    const room = requireRoom(state);
    const date = getString(body.date);
    assertFutureDate(date);
    const owner = room.owners.get(date) ?? '';
    if (owner === '' || owner === room.meMemberId || !memberOf(room, owner)?.linked) {
      fail(409, 'Error.RoomDayNotRequestable', 'Этот день нельзя запросить', [date]);
    }
    let request = room.outgoing.find((r) => r.date === date);
    if (!request) {
      request = { id: `mock-room-request-${Date.now()}`, date, memberId: owner };
      room.outgoing.push(request);
    }
    bump(state);
    return { value: { id: request.id, date, toMemberId: request.memberId } };
  }

  const requestMatch = path.match(/^\/api\/admin\/room\/requests\/([^/]+)(?:\/(accept|decline))?$/);
  if (requestMatch) {
    const room = requireRoom(state);
    const [, id, action] = requestMatch;
    if (method === 'DELETE' && !action) {
      room.outgoing = room.outgoing.filter((r) => r.id !== id);
      bump(state);
      return { value: undefined };
    }
    if (method === 'POST' && action) {
      const request = room.incoming.find((r) => r.id === id);
      if (!request) {
        fail(404, 'Error.RoomRequestNotFound', 'Запрос не найден');
      }
      if (action === 'accept') {
        if ((activeBookingCounts(state).get(request.date) ?? 0) > 0) {
          fail(409, 'Error.WorkDateHasBookings', 'На этот день есть записи', [request.date]);
        }
        room.owners.set(request.date, request.memberId);
        state.workDates?.delete(request.date);
        cancelRequestsFor(room, request.date);
      } else {
        room.incoming = room.incoming.filter((r) => r.id !== id);
      }
      bump(state);
      return { value: {} };
    }
  }
  return undefined;
}

function handleWorkDates(state: TMockState, body: Record<string, unknown>): TRoomHandled {
  const open = (Array.isArray(body.open) ? body.open : []) as {
    date?: unknown;
    intervals?: unknown;
  }[];
  const close = (Array.isArray(body.close) ? body.close : []).map((d) => getString(d));
  const room = state.room;
  const counts = activeBookingCounts(state);
  const workDates = state.workDates ?? new Map();

  for (const item of open) {
    assertFutureDate(getString(item.date));
  }
  for (const date of close) {
    assertFutureDate(date);
  }
  if (room) {
    const taken = open
      .map((o) => getString(o.date))
      .filter((date) => {
        const owner = room.owners.get(date);
        return owner !== undefined && owner !== room.meMemberId;
      });
    if (taken.length > 0) {
      fail(409, 'Error.RoomDayTaken', 'Этот день уже занят коллегой', taken);
    }
  }
  const booked = close.filter((date) => (counts.get(date) ?? 0) > 0);
  if (booked.length > 0) {
    fail(409, 'Error.WorkDateHasBookings', 'На эти дни есть записи', booked);
  }

  for (const item of open) {
    const date = getString(item.date);
    const intervals = Array.isArray(item.intervals) ? (item.intervals as TWorkingInterval[]) : null;
    workDates.set(date, intervals?.length ? clone(intervals) : null);
    if (room) {
      room.owners.set(date, room.meMemberId);
      cancelRequestsFor(room, date);
    }
  }
  for (const date of close) {
    workDates.delete(date);
    if (room?.owners.get(date) === room?.meMemberId) {
      room?.owners.delete(date);
    }
  }
  state.workDates = workDates;
  bump(state);
  return { value: adminWorkDates(state) };
}

function handleScheduleSettings(state: TMockState, body: Record<string, unknown>): TRoomHandled {
  const mode = getString(body.scheduleMode);
  if (mode !== 'weekly' && mode !== 'dates') {
    fail(400, 'Error.BadRequest', 'Неизвестный режим расписания');
  }
  const intervals = Array.isArray(body.defaultIntervals)
    ? (body.defaultIntervals as TWorkingInterval[])
    : [];
  if (mode === 'weekly' && state.room) {
    // Plain-text 409 like the real API: the schedule page shows the message as a toast.
    throw new ApiError(
      'Пока вы в кабинете, расписание работает только по датам. Чтобы вернуться к постоянному графику, выйдите из кабинета.',
      409,
    );
  }
  if (mode === 'dates' && intervals.length === 0) {
    fail(400, 'Error.BadRequest', 'Укажите часы по умолчанию');
  }

  let autoOpened = 0;
  if (mode === 'dates') {
    state.defaultIntervals = clone(intervals);
    if (state.scheduleMode !== 'dates') {
      const workDates = state.workDates ?? new Map();
      const today = todayISO();
      for (const date of activeBookingCounts(state).keys()) {
        if (date >= today && !workDates.has(date)) {
          workDates.set(date, null);
          autoOpened++;
        }
      }
      state.workDates = workDates;
    }
  }
  state.scheduleMode = mode;
  bumpChangeVersions(state, ['workingHours']);
  return {
    value: {
      scheduleMode: mode,
      defaultIntervals: clone(state.defaultIntervals ?? []),
      autoOpened,
    },
  };
}

/***************************************************************************************************
 * Mock handlers for the dates schedule mode and the shared room. Called by `fetchMockAPI` before
 * the regular handlers. Returns undefined for everything it does not own, so the default scenario
 * keeps its exact previous behaviour: schedule contexts and availability are only taken over
 * once the state is in dates mode.
 ***************************************************************************************************/
export function handleRoomApi(
  state: TMockState,
  method: string,
  endpoint: string,
  path: string,
  body: Record<string, unknown>,
): TRoomHandled | undefined {
  prepare(state);

  if (path === '/api/admin/room' || path.startsWith('/api/admin/room/')) {
    return handleRoomRoutes(state, method, path, body);
  }
  if (method === 'PUT' && path === '/api/admin/work-dates') {
    return handleWorkDates(state, body);
  }
  if (method === 'PUT' && path === '/api/admin/schedule-settings') {
    return handleScheduleSettings(state, body);
  }
  if (method === 'GET' && state.scheduleMode === 'dates') {
    if (path === '/api/admin/schedule-context') {
      return { value: adminScheduleContext(state) };
    }
    if (path === '/api/schedule-context') {
      return { value: publicScheduleContext(state) };
    }
    if (path === '/api/availability') {
      return { value: clone(datesAvailability(state, endpoint)) };
    }
  }
  return undefined;
}
