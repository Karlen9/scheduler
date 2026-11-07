import {
  addDays,
  addMinutesToTime,
  clone,
  dateString,
  formatDateISO,
  isPastTodayTime,
  timeToMinutes,
} from './utils';

import type {
  TAdminBookingsResponse,
  TBooking,
  TBookingListResponse,
  TClientListResponse,
  TRecurringSchedule,
  TTimeSlot,
} from '../types';
import type { TMockState } from './types';

export function getAllBookings(state: TMockState): TBooking[] {
  return [
    ...state.bookings,
    ...state.recurringSchedules.flatMap((schedule) => schedule.bookings ?? []),
  ];
}

export function getAdminBookingsPage(state: TMockState, endpoint: string): TAdminBookingsResponse {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const statuses = params.getAll('status');
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  const client = (params.get('client') ?? '').trim().toLowerCase();
  const clientIds = params.getAll('clientId');
  const serviceIds = params.getAll('serviceId');
  const sort = params.get('sort') ?? 'created_desc';
  const page = Math.max(Number(params.get('page') ?? 1) || 1, 1);
  const limit = Math.max(Number(params.get('limit') ?? 20) || 20, 1);

  let bookings = getAllBookings(state).filter((booking) => {
    if (statuses.length > 0 && !statuses.includes(booking.status)) {
      return false;
    }
    if (dateFrom && booking.startsAt.slice(0, 10) < dateFrom) {
      return false;
    }
    if (dateTo && booking.startsAt.slice(0, 10) > dateTo) {
      return false;
    }
    if (serviceIds.length > 0 && !serviceIds.includes(booking.sessionType?.id ?? '')) {
      return false;
    }
    if (clientIds.length > 0 && !clientIds.includes(booking.clientId ?? '')) {
      return false;
    }
    if (!client) {
      return true;
    }

    const haystack = [
      booking.clientName,
      booking.clientDisplayName ?? '',
      booking.clientMessage ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(client);
  });

  bookings = [...bookings].sort((a, b) => {
    if (sort === 'starts_at_asc') {
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    }
    if (sort === 'starts_at_desc') {
      return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
    }
    if (sort === 'status_asc') {
      return (
        a.status.localeCompare(b.status) ||
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
      );
    }
    return (
      new Date(b.createdAt ?? b.startsAt).getTime() - new Date(a.createdAt ?? a.startsAt).getTime()
    );
  });

  const total = bookings.length;
  const offset = (page - 1) * limit;
  const pageBookings = bookings.slice(offset, offset + limit);
  return {
    bookings: clone(pageBookings),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function getClientBookingsPage(state: TMockState, endpoint: string): TBookingListResponse {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const page = Math.max(Number(params.get('page') ?? 1) || 1, 1);
  const limit = Math.max(Number(params.get('limit') ?? 20) || 20, 1);
  const bookings = getAllBookings(state)
    .filter((booking) => booking.clientName === state.clientProfile.name)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const total = bookings.length;
  const offset = (page - 1) * limit;
  const pageBookings = bookings.slice(offset, offset + limit);
  return {
    bookings: clone(pageBookings),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function getAdminClientsPage(state: TMockState, endpoint: string): TClientListResponse {
  const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const search = (params.get('search') ?? '').trim().toLowerCase();
  const page = Math.max(Number(params.get('page') ?? 1) || 1, 1);
  const limit = Math.max(Number(params.get('limit') ?? 50) || 50, 1);

  const filtered = state.clients.filter((client) => {
    if (!search) {
      return true;
    }
    const haystack = [
      client.displayName ?? '',
      client.name,
      client.phone ?? '',
      client.telegramUsername ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const pageClients = filtered.slice(offset, offset + limit);
  return {
    clients: clone(pageClients),
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    searchQuery: search,
  };
}

export function findBooking(state: TMockState, bookingId: string): TBooking | null {
  return getAllBookings(state).find((booking) => booking.id === bookingId) ?? null;
}

export function getSchedule(state: TMockState, id: string): TRecurringSchedule {
  const schedule = state.recurringSchedules.find((item) => item.id === id);
  if (!schedule) {
    throw new Error('Mock recurring schedule not found');
  }
  return schedule;
}

export function buildPreviewDates(dayTimes: Record<string, string>): string[] {
  const targetDays = Object.keys(dayTimes).map(Number);
  if (targetDays.length === 0) {
    return [];
  }

  const dates: string[] = [];
  for (let offset = 1; offset <= 70 && dates.length < 10; offset++) {
    const date = addDays(offset);
    if (targetDays.includes(date.getDay())) {
      dates.push(formatDateISO(date));
    }
  }

  return dates;
}

export function getAvailableSlots(state: TMockState, endpoint: string): TTimeSlot[] {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const date = query.get('date') ?? dateString(1);
  const duration = Number(query.get('duration') ?? '60');
  const excludeBookingId = query.get('excludeBookingId');
  const excludedBooking = excludeBookingId
    ? getAllBookings(state).find((booking) => booking.id === excludeBookingId)
    : undefined;
  const visibleBookings = getAllBookings(state).filter(
    (booking) =>
      booking.id !== excludeBookingId &&
      booking.startsAt.startsWith(date) &&
      ['pending', 'confirmed', 'reschedule_pending'].includes(booking.status),
  );
  // Start time (HH:MM, wall clock) of the booking being rescheduled when it falls on this date.
  const currentTime = excludedBooking?.startsAt.startsWith(date)
    ? excludedBooking.startsAt.slice(11, 16)
    : null;

  const slotDate = new Date(`${date}T00:00:00Z`);
  const dayWorkingHours = state.workingHours.filter(
    (workingHours) => workingHours.dayOfWeek === slotDate.getUTCDay(),
  );
  if (duration <= 0 || state.daysOff.some((item) => item.date === date)) {
    return [];
  }

  const slots: TTimeSlot[] = [];
  const seen = new Set<string>();
  for (const workingHours of dayWorkingHours) {
    const startMinutes = timeToMinutes(workingHours.startTime);
    const endMinutes = timeToMinutes(workingHours.endTime);
    for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += duration) {
      const time = addMinutesToTime('00:00', minutes);
      if (seen.has(time)) {
        continue;
      }
      if (isPastTodayTime(date, time)) {
        seen.add(time);
        continue;
      }

      const slotStart = new Date(`${date}T${time}:00Z`);
      const slotEnd = new Date(slotStart);
      slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + duration);
      const booked = visibleBookings.find((booking) => {
        const bookingStart = new Date(booking.startsAt);
        const bookingEnd = new Date(booking.endsAt);
        return slotStart < bookingEnd && slotEnd > bookingStart;
      });

      seen.add(time);
      const isCurrent = time === currentTime;
      slots.push({
        time,
        endTime: addMinutesToTime(time, duration),
        available: !booked && !isCurrent,
        mine: booked?.clientName === state.clientProfile.name,
        ...(isCurrent ? { current: true } : {}),
      });
    }
  }

  if (currentTime && !seen.has(currentTime)) {
    // The booking's own start is not on the regular slot grid: still surface it as "current".
    slots.push({
      time: currentTime,
      endTime: addMinutesToTime(currentTime, duration),
      available: false,
      current: true,
    });
    slots.sort((left, right) => left.time.localeCompare(right.time));
  }

  return slots;
}
