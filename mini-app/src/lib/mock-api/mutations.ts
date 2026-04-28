import { bumpChangeVersions } from './state';
import {
  addMinutesToISO,
  clone,
  dateString,
  getNumber,
  getOptionalString,
  getRecord,
  getString,
  isPastTodayTime,
  isoAt,
} from './utils';

import type { TBooking, TClientInfo, TRecurringSchedule } from '../types';
import type { TMockState } from './types';

export function updateBooking(
  state: TMockState,
  bookingId: string,
  updater: (booking: TBooking) => TBooking,
): TBooking {
  let updated: TBooking | null = null;

  state.bookings = state.bookings.map((booking) => {
    if (booking.id !== bookingId) {
      return booking;
    }
    updated = updater(booking);
    return updated;
  });

  state.recurringSchedules = state.recurringSchedules.map((schedule) => ({
    ...schedule,
    bookings: schedule.bookings?.map((booking) => {
      if (booking.id !== bookingId) {
        return booking;
      }
      updated = updater(booking);
      return updated;
    }),
  }));

  if (!updated) {
    throw new Error('Mock booking not found');
  }

  bumpChangeVersions(state, ['bookings']);
  return clone(updated);
}

export function updateSchedule(
  state: TMockState,
  id: string,
  updater: (schedule: TRecurringSchedule) => TRecurringSchedule,
): TRecurringSchedule {
  let updated: TRecurringSchedule | null = null;

  state.recurringSchedules = state.recurringSchedules.map((schedule) => {
    if (schedule.id !== id) {
      return schedule;
    }
    updated = updater(schedule);
    return updated;
  });

  if (!updated) {
    throw new Error('Mock recurring schedule not found');
  }

  bumpChangeVersions(state, ['recurring', 'bookings']);
  return clone(updated);
}

export function createBookingFromBody(
  state: TMockState,
  body: Record<string, unknown>,
  createdBy: 'client' | 'specialist',
): TBooking {
  const service =
    state.services.find((item) => item.id === body.sessionTypeId) ??
    state.services.find((item) => item.durationMinutes === getNumber(body.duration, 60)) ??
    state.services[0];
  const client: TClientInfo =
    createdBy === 'specialist'
      ? (state.clients.find((item) => item.id === body.clientId) ?? state.clients[0])
      : {
          id: state.clientProfile.id,
          telegramUserId: 999,
          specialistId: state.adminProfile.id,
          name: getString(body.name, state.clientProfile.name),
          displayName: state.clientProfile.name,
          phone: state.clientProfile.phone,
          photoUrl: state.clientProfile.photoUrl,
          createdAt: isoAt(-1, '09:00'),
        };
  const date = getString(body.date, dateString(1));
  const time = getString(body.time, '10:00');
  if (createdBy === 'client' && isPastTodayTime(date, time)) {
    throw new Error('Cannot book a time in the past');
  }

  const activeBatch =
    service.type === 'batch'
      ? state.clientBatches.find(
          (batch) =>
            batch.clientId === client.id &&
            batch.serviceId === service.id &&
            batch.status === 'active' &&
            batch.remainingSessions > 0,
        )
      : undefined;
  if (service.type === 'batch' && !activeBatch) {
    throw new Error('No active batch');
  }

  const startsAt = `${date}T${time}:00Z`;
  const booking: TBooking = {
    id: `mock-booking-${Date.now()}`,
    clientId: client.id,
    clientBatchId: activeBatch?.id,
    sessionType: service,
    startsAt,
    endsAt: addMinutesToISO(startsAt, service.durationMinutes),
    clientName: client.name,
    clientDisplayName: client.displayName,
    clientPhotoUrl: client.photoUrl,
    clientIsGhost: client.isGhost,
    clientTelegramUserId: client.telegramUserId,
    clientTelegramUsername: client.telegramUsername,
    clientMessage: getOptionalString(body.message),
    status: createdBy === 'specialist' || client.isGhost ? 'confirmed' : 'pending',
    durationMinutes: service.durationMinutes,
    createdBy,
    createdAt: new Date().toISOString(),
  };

  state.bookings = [booking, ...state.bookings];
  bumpChangeVersions(state, ['bookings', 'clients']);
  return clone(booking);
}

export function createRecurringSchedule(
  state: TMockState,
  body: Record<string, unknown>,
  createdBy: 'client' | 'specialist',
): TRecurringSchedule {
  const dayTimes = getRecord(body.dayTimes);
  const firstDay = Number(Object.keys(dayTimes)[0] ?? 1);
  const firstTime = dayTimes[firstDay] ?? '10:00';
  const service =
    state.services.find((item) => item.id === body.sessionTypeId) ?? state.services[0];
  const client: TClientInfo =
    createdBy === 'specialist'
      ? (state.clients.find((item) => item.id === body.clientId) ?? state.clients[0])
      : {
          id: state.clientProfile.id,
          telegramUserId: 999,
          specialistId: state.adminProfile.id,
          name: state.clientProfile.name,
          displayName: state.clientProfile.name,
          phone: state.clientProfile.phone,
          photoUrl: state.clientProfile.photoUrl,
          createdAt: isoAt(-1, '09:00'),
        };

  const schedule: TRecurringSchedule = {
    id: `mock-recurring-${Date.now()}`,
    clientName: client.name,
    clientDisplayName: client.displayName,
    clientPhotoUrl: client.photoUrl,
    dayOfWeek: firstDay,
    time: firstTime,
    durationMinutes: service.durationMinutes,
    status: createdBy === 'specialist' ? 'active' : 'pending',
    createdBy,
    createdAt: new Date().toISOString(),
    sessionTypeId: service.id,
    sessionType: service,
    daysOfWeek: Object.keys(dayTimes).join(','),
    startDate: dateString(1),
    endDate: dateString(60),
    dayTimes: JSON.stringify(dayTimes),
    bookings: [],
  };

  state.recurringSchedules = [schedule, ...state.recurringSchedules];
  bumpChangeVersions(state, ['recurring', 'bookings']);
  return clone(schedule);
}
