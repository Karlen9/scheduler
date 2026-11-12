import {
  createSlotPlanner,
  getDaySlots,
  nextWorkingOffset,
  slotTimeFor,
} from './fixtures-schedule';
import { buildBooking, dateString, isoAt } from './utils';

import type { TClientsByKey } from './fixtures-clients';
import type { TSlotPlanner } from './fixtures-schedule';
import type {
  TBooking,
  TClientBatch,
  TClientInfo,
  TDayOff,
  TRecurringSchedule,
  TSessionType,
} from '../types';

type TServicesByKey = {
  personal: TSessionType;
  mobility: TSessionType;
  consult: TSessionType;
  relax: TSessionType;
  neck: TSessionType;
};

type TBookingExtras = Partial<
  Pick<TBooking, 'cancelReason' | 'cancelledBy' | 'clientBatchId' | 'replacesBookingId'>
>;

const PAST_START = -56;
const FUTURE_END = 21;

const CLIENT_MESSAGES = [
  'Спасибо, буду вовремя!',
  'Можно чуть больше внимания шее и плечам?',
  'Если будет возможность, подойду на 10 минут раньше.',
  'После долгой сидячей работы сильно затекла спина.',
  'Первый раз у вас, подскажите, что взять с собой?',
];

export function createDaysOff(): TDayOff[] {
  return [
    {
      id: 'mock-day-off-1',
      date: dateString(nextWorkingOffset(8)),
      reason: 'Обучение: курс по мышечно-фасциальному релизу',
      createdAt: isoAt(-6, '09:00'),
    },
    {
      id: 'mock-day-off-2',
      date: dateString(nextWorkingOffset(18)),
      reason: 'Личные дела',
      createdAt: isoAt(-2, '09:00'),
    },
    {
      id: 'mock-day-off-3',
      date: dateString(nextWorkingOffset(27)),
      reason: 'Отпуск',
      createdAt: isoAt(-1, '09:00'),
    },
  ];
}

export function createClientBatches(
  clients: TClientsByKey,
  services: TServicesByKey,
): TClientBatch[] {
  const batch = (
    id: string,
    client: TClientInfo,
    service: TSessionType,
    remaining: number,
    createdDaysAgo: number,
  ): TClientBatch => ({
    id,
    clientId: client.id,
    serviceId: service.id,
    totalSessions: service.sessionsCount ?? 10,
    remainingSessions: remaining,
    createdAt: isoAt(-createdDaysAgo, '10:00'),
    status: remaining > 0 ? 'active' : 'exhausted',
    service,
  });

  return [
    batch('mock-client-batch-active', clients.elena, services.mobility, 7, 30),
    batch('mock-batch-anna', clients.anna, services.mobility, 5, 42),
    batch('mock-batch-ivan', clients.ivan, services.mobility, 6, 21),
    batch('mock-batch-dasha', clients.dasha, services.neck, 2, 36),
    batch('mock-batch-natalia', clients.natalia, services.neck, 0, 90),
  ];
}

function buildRecurring({
  bookingCtx,
  client,
  createdBy,
  createdDaysAgo,
  id,
  legacyIds = [],
  rescheduleLegacyIndex,
  service,
  slotsByDay,
  status,
  withBookings,
}: {
  bookingCtx: { planner: TSlotPlanner; days: number };
  client: TClientInfo;
  createdBy: 'client' | 'specialist';
  createdDaysAgo: number;
  id: string;
  legacyIds?: string[];
  rescheduleLegacyIndex?: number;
  service: TSessionType;
  slotsByDay: Record<number, number>;
  status: TRecurringSchedule['status'];
  withBookings: boolean;
}): TRecurringSchedule {
  const dayTimes: Record<string, string> = {};
  for (const [day, slotIndex] of Object.entries(slotsByDay)) {
    dayTimes[day] = slotTimeFor(Number(day), slotIndex);
  }
  const days = Object.keys(dayTimes)
    .map(Number)
    .sort((a, b) => a - b);

  const bookings: TBooking[] = [];
  if (withBookings) {
    let futureIndex = 0;
    let pastIndex = 0;
    for (let offset = -28; offset <= FUTURE_END; offset++) {
      const dayOfWeek = new Date(`${dateString(offset)}T00:00:00Z`).getUTCDay();
      if (!days.includes(dayOfWeek)) {
        continue;
      }
      const time = dayTimes[dayOfWeek];
      if (!bookingCtx.planner.reserveExact(offset, time, client.id)) {
        continue;
      }
      const isPast = offset < 0;
      const bookingId = isPast
        ? `${id}-past-${++pastIndex}`
        : (legacyIds[futureIndex] ?? `${id}-${futureIndex + 1}`);
      bookings.push(
        buildBooking({
          id: bookingId,
          client,
          service,
          days: offset,
          time,
          status: isPast
            ? 'completed'
            : futureIndex === rescheduleLegacyIndex
              ? 'reschedule_pending'
              : 'confirmed',
          createdBy,
          recurringScheduleId: id,
        }),
      );
      if (!isPast) {
        futureIndex++;
      }
    }
  }

  return {
    id,
    clientName: client.name,
    clientDisplayName: client.displayName,
    clientPhotoUrl: client.photoUrl,
    dayOfWeek: days[0],
    time: dayTimes[days[0]],
    durationMinutes: service.durationMinutes,
    status,
    createdBy,
    createdAt: isoAt(-createdDaysAgo, '08:00'),
    sessionTypeId: service.id,
    sessionType: service,
    daysOfWeek: days.join(','),
    startDate: withBookings ? dateString(-28) : dateString(nextWorkingOffset(5)),
    endDate: dateString(bookingCtx.days),
    dayTimes: JSON.stringify(dayTimes),
    bookings,
  };
}

export function createRecurringSchedules(
  planner: TSlotPlanner,
  clients: TClientsByKey,
  services: TServicesByKey,
): TRecurringSchedule[] {
  const ctx = { planner, days: 60 };

  return [
    buildRecurring({
      bookingCtx: ctx,
      client: clients.anna,
      createdBy: 'client',
      createdDaysAgo: 30,
      id: 'mock-recurring-active',
      legacyIds: ['mock-recurring-active-1', 'mock-recurring-active-2', 'mock-recurring-active-3'],
      rescheduleLegacyIndex: 2,
      service: services.personal,
      slotsByDay: { 1: 1, 3: 3 },
      status: 'active',
      withBookings: true,
    }),
    buildRecurring({
      bookingCtx: ctx,
      client: clients.elena,
      createdBy: 'client',
      createdDaysAgo: 28,
      id: 'mock-recurring-elena',
      service: services.personal,
      slotsByDay: { 2: 4 },
      status: 'active',
      withBookings: true,
    }),
    buildRecurring({
      bookingCtx: ctx,
      client: clients.sergey,
      createdBy: 'specialist',
      createdDaysAgo: 28,
      id: 'mock-recurring-sergey',
      service: services.relax,
      slotsByDay: { 6: 0 },
      status: 'active',
      withBookings: true,
    }),
    buildRecurring({
      bookingCtx: ctx,
      client: clients.maria,
      createdBy: 'client',
      createdDaysAgo: 1,
      id: 'mock-recurring-pending',
      service: services.mobility,
      slotsByDay: { 5: 3 },
      status: 'pending',
      withBookings: false,
    }),
    buildRecurring({
      bookingCtx: ctx,
      client: clients.elena,
      createdBy: 'specialist',
      createdDaysAgo: 2,
      id: 'mock-recurring-elena-pending',
      service: services.relax,
      slotsByDay: { 6: 1 },
      status: 'pending',
      withBookings: false,
    }),
    buildRecurring({
      bookingCtx: ctx,
      client: clients.ivan,
      createdBy: 'client',
      createdDaysAgo: 5,
      id: 'mock-recurring-declined',
      service: services.consult,
      slotsByDay: { 2: 2 },
      status: 'declined',
      withBookings: false,
    }),
  ];
}

export function createBookings(
  planner: TSlotPlanner,
  clients: TClientsByKey,
  services: TServicesByKey,
): TBooking[] {
  const bookings: TBooking[] = [];

  const add = (
    id: string,
    client: TClientInfo,
    service: TSessionType,
    days: number,
    slotIndex: number,
    status: TBooking['status'],
    createdBy: 'client' | 'specialist',
    message?: string,
    extras: TBookingExtras = {},
  ): void => {
    const slot = planner.reserve(days, slotIndex, client.id);
    bookings.push({
      ...buildBooking({
        id,
        client,
        service,
        days: slot.days,
        time: slot.time,
        status,
        createdBy,
        message,
      }),
      ...extras,
    });
  };

  const { anna, ivan, maria, dasha, sergey, katya, dmitry, alina, pavel, natalia, andrey, olga } =
    clients;
  const { elena, mikhail } = clients;
  const { personal, mobility, consult, relax, neck } = services;

  add(
    'mock-booking-test-client-confirmed',
    elena,
    personal,
    2,
    2,
    'confirmed',
    'client',
    'Спасибо, буду вовремя!',
  );
  add(
    'mock-booking-pending',
    anna,
    personal,
    1,
    1,
    'pending',
    'client',
    'Можно уделить больше внимания пояснице?',
  );
  add('mock-booking-confirmed', ivan, mobility, 2, 0, 'confirmed', 'client', undefined, {
    clientBatchId: 'mock-batch-ivan',
  });
  add(
    'mock-booking-specialist-created',
    maria,
    personal,
    3,
    2,
    'pending',
    'specialist',
    'Предлагаю этот слот, подойдёт ли вам?',
  );
  add(
    'mock-booking-cancel-request',
    anna,
    mobility,
    5,
    2,
    'cancel_requested',
    'client',
    'Уезжаю в командировку.',
    { clientBatchId: 'mock-batch-anna' },
  );
  add('mock-booking-confirmed-2', maria, consult, 7, 1, 'confirmed', 'client');
  add('mock-booking-completed', ivan, personal, -4, 4, 'completed', 'client');
  add('mock-booking-cancelled', maria, consult, -9, 1, 'cancelled', 'client', undefined, {
    cancelledBy: 'client',
    cancelReason: 'Заболела, прошу прощения.',
  });

  add(
    'mock-booking-pending-sergey',
    sergey,
    relax,
    2,
    3,
    'pending',
    'client',
    'Первый раз, беспокоит шея.',
  );
  add(
    'mock-booking-pending-dasha',
    dasha,
    personal,
    4,
    1,
    'pending',
    'client',
    'Если есть окно, лучше во второй половине дня.',
  );
  add('mock-booking-pending-alina', alina, consult, 6, 0, 'pending', 'client');
  add(
    'mock-booking-reschedule',
    natalia,
    personal,
    6,
    2,
    'reschedule_pending',
    'specialist',
    'Перенос на другое время по просьбе специалиста.',
  );
  add('mock-booking-today-extra', katya, relax, 0, 0, 'confirmed', 'client');
  add('mock-booking-today-neck', dasha, neck, 0, 2, 'confirmed', 'client', undefined, {
    clientBatchId: 'mock-batch-dasha',
  });
  add('mock-booking-tomorrow-extra', mikhail, personal, 1, 2, 'confirmed', 'specialist');
  add('mock-booking-confirmed-olga', olga, consult, 3, 0, 'confirmed', 'client');
  add('mock-booking-confirmed-andrey', andrey, personal, 8, 1, 'confirmed', 'client');
  add('mock-booking-confirmed-katya', katya, relax, 10, 2, 'confirmed', 'client');
  add('mock-booking-confirmed-dmitry', dmitry, personal, 12, 0, 'confirmed', 'specialist');

  add('mock-booking-elena-future-1', elena, relax, 9, 1, 'confirmed', 'client');
  add(
    'mock-booking-elena-pending',
    elena,
    personal,
    4,
    4,
    'pending',
    'client',
    'Прошу время ближе к вечеру.',
  );
  const elenaHistory: [number, TSessionType, TBooking['status']][] = [
    [-3, personal, 'completed'],
    [-7, mobility, 'completed'],
    [-10, relax, 'completed'],
    [-14, mobility, 'completed'],
    [-17, personal, 'completed'],
    [-21, consult, 'completed'],
    [-24, mobility, 'completed'],
    [-31, personal, 'cancelled'],
    [-35, relax, 'completed'],
    [-42, personal, 'completed'],
    [-49, personal, 'completed'],
    [-53, consult, 'completed'],
  ];
  elenaHistory.forEach(([days, service, status], index) => {
    add(
      `mock-booking-elena-history-${index + 1}`,
      elena,
      service,
      days,
      index % 5,
      status,
      'client',
      undefined,
      {
        ...(service.type === 'batch' ? { clientBatchId: 'mock-client-batch-active' } : {}),
        ...(status === 'cancelled'
          ? { cancelledBy: 'client' as const, cancelReason: 'Изменились планы.' }
          : {}),
      },
    );
  });

  add('mock-booking-rejected-pavel', pavel, personal, -12, 1, 'rejected', 'client');
  add(
    'mock-booking-cancelled-dmitry',
    dmitry,
    relax,
    -20,
    2,
    'cancelled',
    'specialist',
    undefined,
    {
      cancelledBy: 'specialist',
      cancelReason: 'Специалист заболел, перенесём на другой день.',
    },
  );
  add('mock-booking-cancelled-andrey', andrey, personal, -6, 3, 'cancelled', 'client', undefined, {
    cancelledBy: 'client',
    cancelReason: 'Изменились планы.',
  });

  return bookings;
}

export function fillBookings(
  planner: TSlotPlanner,
  clients: TClientsByKey,
  services: TServicesByKey,
  existing: TBooking[],
): TBooking[] {
  const regulars = [
    clients.anna,
    clients.ivan,
    clients.maria,
    clients.dasha,
    clients.sergey,
    clients.katya,
    clients.dmitry,
    clients.alina,
    clients.natalia,
    clients.andrey,
    clients.olga,
    clients.mikhail,
    clients.guest,
  ];
  const serviceRotation = [
    services.personal,
    services.relax,
    services.personal,
    services.consult,
    services.personal,
    services.relax,
  ];
  const generated: TBooking[] = [];
  let counter = 0;

  for (let days = PAST_START; days <= FUTURE_END; days++) {
    const slots = getDaySlots(days);
    if (slots.length === 0) {
      continue;
    }
    const wanted =
      days === 0 || days === 1 ? 5 : days === 2 ? 4 : days < 0 ? (days % 3 === 0 ? 2 : 1) : 1;
    const target = Math.min(wanted, slots.length);

    for (let attempt = 0; attempt < 40 && planner.count(days) < target; attempt++) {
      const client = regulars[(counter * 5 + days + 100) % regulars.length];
      const time = planner.freeSlot(days, client.id, counter % slots.length);
      counter++;
      if (!time) {
        continue;
      }
      planner.reserveExact(days, time, client.id);

      const isPast = days < 0;
      let status: TBooking['status'] = isPast ? 'completed' : 'confirmed';
      let extras: TBookingExtras = {};
      if (isPast && counter % 11 === 0) {
        status = 'cancelled';
        extras = { cancelledBy: 'client', cancelReason: 'Изменились планы.' };
      }
      const service = serviceRotation[counter % serviceRotation.length];
      generated.push({
        ...buildBooking({
          id: `mock-booking-gen-${counter}`,
          client,
          service,
          days,
          time,
          status,
          createdBy: counter % 4 === 0 ? 'specialist' : 'client',
          message:
            counter % 7 === 0 ? CLIENT_MESSAGES[counter % CLIENT_MESSAGES.length] : undefined,
        }),
        ...extras,
      });
    }
  }

  return [...existing, ...generated];
}

export function createPlanner(daysOff: TDayOff[]): TSlotPlanner {
  const today = new Date(`${dateString(0)}T00:00:00Z`).getTime();
  const blocked = daysOff.map((dayOff) =>
    Math.round((new Date(`${dayOff.date}T00:00:00Z`).getTime() - today) / 86_400_000),
  );
  return createSlotPlanner(blocked);
}
