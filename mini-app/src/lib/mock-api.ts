import type {
  TAdminScheduleContext,
  TAdminStats,
  TBooking,
  TChangeGroup,
  TChangeVersions,
  TClientInfo,
  TClientProfile,
  TClientStats,
  TDayOff,
  TRecurringPreviewResponse,
  TRecurringSchedule,
  TScheduleContext,
  TSessionType,
  TSpecialist,
  TTimeSlot,
  TWorkingHours,
} from './types';

type TAdminNotifications = {
  notifyNewBookings: boolean;
  notifyCancellations: boolean;
};

type TMockState = {
  adminNotifications: TAdminNotifications;
  adminProfile: TSpecialist;
  bookings: TBooking[];
  changeVersions: TChangeVersions;
  clientProfile: TClientProfile;
  clientSpecialist: TSpecialist;
  clients: TClientInfo[];
  daysOff: TDayOff[];
  recurringSchedules: TRecurringSchedule[];
  services: TSessionType[];
  workingHours: TWorkingHours[];
};

const changeGroups: TChangeGroup[] = [
  'bookings',
  'recurring',
  'clients',
  'services',
  'workingHours',
  'daysOff',
  'specialist',
  'clientProfile',
  'adminNotifications',
];

const mockPhotoDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

let mockState: TMockState | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseRequestBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') {
    return {};
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function getRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((result, [key, val]) => {
    if (typeof val === 'string') {
      result[key] = val;
    }
    return result;
  }, {});
}

function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function dateString(days: number): string {
  return formatDateISO(addDays(days));
}

function isoAt(days: number, time: string): string {
  return `${dateString(days)}T${time}:00Z`;
}

function addMinutesToISO(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function buildBooking({
  client,
  createdBy,
  days,
  id,
  message,
  recurringScheduleId,
  service,
  status,
  time,
}: {
  client: TClientInfo;
  createdBy: 'client' | 'specialist';
  days: number;
  id: string;
  message?: string;
  recurringScheduleId?: string;
  service: TSessionType;
  status: TBooking['status'];
  time: string;
}): TBooking {
  const startsAt = isoAt(days, time);

  return {
    id,
    sessionType: service,
    startsAt,
    endsAt: addMinutesToISO(startsAt, service.durationMinutes),
    clientName: client.name,
    clientDisplayName: client.displayName,
    clientPhotoUrl: client.photoUrl,
    clientMessage: message,
    status,
    durationMinutes: service.durationMinutes,
    createdBy,
    recurringScheduleId,
  };
}

function createInitialChangeVersions(): TChangeVersions {
  return changeGroups.reduce<TChangeVersions>((versions, group) => {
    versions[group] = 1;
    return versions;
  }, {} as TChangeVersions);
}

function createMockState(): TMockState {
  const services: TSessionType[] = [
    {
      id: 'mock-service-personal',
      type: 'personal',
      name: 'Personal training',
      durationMinutes: 60,
      price: 3500,
      currency: 'RUB',
    },
    {
      id: 'mock-service-mobility',
      type: 'mobility',
      name: 'Mobility session',
      durationMinutes: 45,
      price: 2800,
      currency: 'RUB',
    },
    {
      id: 'mock-service-consultation',
      type: 'consultation',
      name: 'Nutrition consultation',
      durationMinutes: 30,
      price: 2200,
      currency: 'RUB',
    },
  ];

  const clients: TClientInfo[] = [
    {
      id: 'mock-client-anna',
      telegramUserId: 101,
      specialistId: 'mock-specialist',
      name: 'Anna Morozova',
      displayName: 'Anna',
      phone: '+7 900 111-22-33',
      createdAt: isoAt(-80, '09:00'),
    },
    {
      id: 'mock-client-ivan',
      telegramUserId: 102,
      specialistId: 'mock-specialist',
      name: 'Ivan Petrov',
      displayName: 'Ivan P.',
      phone: '+7 900 222-33-44',
      createdAt: isoAt(-35, '09:00'),
    },
    {
      id: 'mock-client-maria',
      telegramUserId: 103,
      specialistId: 'mock-specialist',
      name: 'Maria Volkova',
      displayName: 'Maria',
      createdAt: isoAt(-12, '09:00'),
    },
    {
      id: 'mock-client-guest',
      telegramUserId: 0,
      specialistId: 'mock-specialist',
      name: 'Guest client',
      isGhost: true,
      createdAt: isoAt(-4, '09:00'),
    },
  ];

  const workingHours: TWorkingHours[] = [
    { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
    { dayOfWeek: 1, startTime: '15:00', endTime: '20:00' },
    { dayOfWeek: 2, startTime: '10:00', endTime: '19:00' },
    { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
    { dayOfWeek: 3, startTime: '15:00', endTime: '20:00' },
    { dayOfWeek: 4, startTime: '10:00', endTime: '19:00' },
    { dayOfWeek: 5, startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 6, startTime: '10:00', endTime: '15:00' },
  ];

  const bookings: TBooking[] = [
    buildBooking({
      id: 'mock-booking-pending',
      client: clients[0],
      service: services[0],
      days: 1,
      time: '10:00',
      status: 'pending',
      createdBy: 'client',
      message: 'Could we focus on lower body?',
    }),
    buildBooking({
      id: 'mock-booking-confirmed',
      client: clients[1],
      service: services[1],
      days: 2,
      time: '12:00',
      status: 'confirmed',
      createdBy: 'client',
    }),
    buildBooking({
      id: 'mock-booking-specialist-created',
      client: clients[2],
      service: services[0],
      days: 3,
      time: '16:00',
      status: 'pending',
      createdBy: 'specialist',
      message: 'Trainer suggested this slot.',
    }),
    buildBooking({
      id: 'mock-booking-cancel-request',
      client: clients[0],
      service: services[1],
      days: 5,
      time: '14:00',
      status: 'cancel_requested',
      createdBy: 'client',
      message: 'Travel day.',
    }),
    buildBooking({
      id: 'mock-booking-completed',
      client: clients[1],
      service: services[0],
      days: -4,
      time: '18:00',
      status: 'completed',
      createdBy: 'client',
    }),
    buildBooking({
      id: 'mock-booking-cancelled',
      client: clients[2],
      service: services[2],
      days: -9,
      time: '11:00',
      status: 'cancelled',
      createdBy: 'client',
    }),
  ];

  const recurringBookings = [
    buildBooking({
      id: 'mock-recurring-active-1',
      client: clients[0],
      service: services[0],
      days: 7,
      time: '10:00',
      status: 'confirmed',
      createdBy: 'client',
      recurringScheduleId: 'mock-recurring-active',
    }),
    buildBooking({
      id: 'mock-recurring-active-2',
      client: clients[0],
      service: services[0],
      days: 14,
      time: '10:00',
      status: 'confirmed',
      createdBy: 'client',
      recurringScheduleId: 'mock-recurring-active',
    }),
    buildBooking({
      id: 'mock-recurring-active-3',
      client: clients[0],
      service: services[0],
      days: 21,
      time: '10:00',
      status: 'reschedule_pending',
      createdBy: 'client',
      recurringScheduleId: 'mock-recurring-active',
    }),
  ];

  const recurringSchedules: TRecurringSchedule[] = [
    {
      id: 'mock-recurring-active',
      clientName: clients[0].name,
      clientDisplayName: clients[0].displayName,
      clientPhotoUrl: clients[0].photoUrl,
      dayOfWeek: 1,
      time: '10:00',
      durationMinutes: services[0].durationMinutes,
      status: 'active',
      createdBy: 'client',
      createdAt: isoAt(-10, '08:00'),
      sessionTypeId: services[0].id,
      sessionType: services[0],
      daysOfWeek: '1,3',
      startDate: dateString(-7),
      endDate: dateString(45),
      dayTimes: JSON.stringify({ 1: '10:00', 3: '17:00' }),
      bookings: recurringBookings,
    },
    {
      id: 'mock-recurring-pending',
      clientName: clients[2].name,
      clientDisplayName: clients[2].displayName,
      dayOfWeek: 5,
      time: '18:00',
      durationMinutes: services[1].durationMinutes,
      status: 'pending',
      createdBy: 'client',
      createdAt: isoAt(-1, '18:20'),
      sessionTypeId: services[1].id,
      sessionType: services[1],
      daysOfWeek: '5',
      startDate: dateString(5),
      endDate: dateString(35),
      dayTimes: JSON.stringify({ 5: '18:00' }),
      bookings: [],
    },
    {
      id: 'mock-recurring-declined',
      clientName: clients[1].name,
      clientDisplayName: clients[1].displayName,
      dayOfWeek: 2,
      time: '12:00',
      durationMinutes: services[2].durationMinutes,
      status: 'declined',
      createdBy: 'client',
      createdAt: isoAt(-5, '12:00'),
      sessionTypeId: services[2].id,
      sessionType: services[2],
      daysOfWeek: '2',
      startDate: dateString(2),
      endDate: dateString(30),
      dayTimes: JSON.stringify({ 2: '12:00' }),
      bookings: [],
    },
  ];

  const specialistBase: TSpecialist = {
    id: 'mock-specialist',
    name: 'Alex Carter',
    timezone: 'Europe/Moscow',
    cancelCutoffHours: 12,
    botUsername: 'mock_scheduler_bot',
    telegramHandle: '@alex_trains',
    phone: '+7 900 555-44-33',
    specialization: 'Strength and mobility coach',
    bio: 'Focused strength work, posture, mobility, and habit-based progress for busy clients.',
  };

  return {
    adminNotifications: {
      notifyNewBookings: true,
      notifyCancellations: true,
    },
    adminProfile: {
      ...specialistBase,
      isOwner: true,
    },
    bookings,
    changeVersions: createInitialChangeVersions(),
    clientProfile: {
      id: 'mock-profile',
      name: 'Test Client',
      phone: '+7 900 777-66-55',
      preferredDuration: 60,
      notifyBookingStatus: true,
      notifyReminders: true,
      notifyDaysOff: false,
      notifyCancellations: true,
    },
    clientSpecialist: {
      ...specialistBase,
      isOwner: false,
    },
    clients,
    daysOff: [
      {
        id: 'mock-day-off-1',
        date: dateString(8),
        reason: 'Gym maintenance',
        createdAt: isoAt(-2, '09:00'),
      },
      {
        id: 'mock-day-off-2',
        date: dateString(18),
        reason: 'Workshop',
        createdAt: isoAt(-1, '09:00'),
      },
    ],
    recurringSchedules,
    services,
    workingHours,
  };
}

function getState(): TMockState {
  mockState ??= createMockState();
  return mockState;
}

function bumpChangeVersions(state: TMockState, groups: TChangeGroup[]): void {
  for (const group of groups) {
    state.changeVersions[group] = (state.changeVersions[group] ?? 0) + 1;
  }
}

function getAllBookings(state: TMockState): TBooking[] {
  return [
    ...state.bookings,
    ...state.recurringSchedules.flatMap((schedule) => schedule.bookings ?? []),
  ];
}

function findBooking(state: TMockState, bookingId: string): TBooking | null {
  return getAllBookings(state).find((booking) => booking.id === bookingId) ?? null;
}

function updateBooking(
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

function getSchedule(state: TMockState, id: string): TRecurringSchedule {
  const schedule = state.recurringSchedules.find((item) => item.id === id);
  if (!schedule) {
    throw new Error('Mock recurring schedule not found');
  }

  return schedule;
}

function updateSchedule(
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

function createBookingFromBody(
  state: TMockState,
  body: Record<string, unknown>,
  createdBy: 'client' | 'specialist',
): TBooking {
  const service =
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
  const startsAt = `${date}T${time}:00Z`;
  const booking: TBooking = {
    id: `mock-booking-${Date.now()}`,
    sessionType: service,
    startsAt,
    endsAt: addMinutesToISO(startsAt, service.durationMinutes),
    clientName: client.name,
    clientDisplayName: client.displayName,
    clientPhotoUrl: client.photoUrl,
    clientMessage: getOptionalString(body.message),
    status: createdBy === 'specialist' || client.isGhost ? 'confirmed' : 'pending',
    durationMinutes: service.durationMinutes,
    createdBy,
  };

  state.bookings = [booking, ...state.bookings];
  bumpChangeVersions(state, ['bookings', 'clients']);
  return clone(booking);
}

function buildPreviewDates(dayTimes: Record<string, string>): string[] {
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

function getAvailableSlots(state: TMockState, endpoint: string): TTimeSlot[] {
  const query = new URLSearchParams(endpoint.split('?')[1] ?? '');
  const date = query.get('date') ?? dateString(1);
  const duration = Number(query.get('duration') ?? '60');
  const visibleBookings = getAllBookings(state).filter(
    (booking) =>
      booking.startsAt.startsWith(date) &&
      ['pending', 'confirmed', 'reschedule_pending'].includes(booking.status),
  );

  return Array.from({ length: 20 }, (_, index) => {
    const time = addMinutesToTime('09:00', index * 30);
    const booked = visibleBookings.find((booking) => booking.startsAt.slice(11, 16) === time);

    return {
      time,
      endTime: addMinutesToTime(time, duration),
      available: !booked,
      mine: booked?.clientName === state.clientProfile.name,
    };
  });
}

function createRecurringSchedule(
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

function updateWorkingHoursForDay(
  state: TMockState,
  day: number,
  intervals: { startTime: string; endTime: string }[],
): TWorkingHours[] {
  state.workingHours = [
    ...state.workingHours.filter((item) => item.dayOfWeek !== day),
    ...intervals.map((interval) => ({ dayOfWeek: day, ...interval })),
  ].sort(
    (left, right) =>
      left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime),
  );
  bumpChangeVersions(state, ['workingHours']);
  return clone(state.workingHours);
}

export async function fetchMockAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const state = getState();
  const method = (options?.method ?? 'GET').toUpperCase();
  const path = endpoint.split('?')[0];
  const body = parseRequestBody(options?.body);

  if (method === 'GET') {
    if (path === '/api/specialist') {
      return clone(state.clientSpecialist) as T;
    }
    if (path === '/api/services' || path === '/api/admin/services') {
      return clone(state.services) as T;
    }
    if (path === '/api/working-hours' || path === '/api/admin/working-hours') {
      return clone(state.workingHours) as T;
    }
    if (path === '/api/schedule-context') {
      return clone({
        workingHours: state.workingHours,
        daysOff: state.daysOff.map((dayOff) => ({ date: dayOff.date })),
      } satisfies TScheduleContext) as T;
    }
    if (path === '/api/admin/schedule-context') {
      return clone({
        workingHours: state.workingHours,
        daysOff: state.daysOff,
      } satisfies TAdminScheduleContext) as T;
    }
    if (path === '/api/days-off') {
      return clone(state.daysOff.map((dayOff) => ({ date: dayOff.date }))) as T;
    }
    if (path === '/api/admin/days-off') {
      return clone(state.daysOff) as T;
    }
    if (path === '/api/availability') {
      return clone(getAvailableSlots(state, endpoint)) as T;
    }
    if (path === '/api/bookings') {
      return clone(getAllBookings(state)) as T;
    }
    if (path === '/api/admin/bookings') {
      const status = new URLSearchParams(endpoint.split('?')[1] ?? '').get('status');
      const bookings = getAllBookings(state);
      return clone(
        status ? bookings.filter((booking) => booking.status === status) : bookings,
      ) as T;
    }
    if (path === '/api/stats') {
      return clone({
        totalSessions: 18,
        totalHours: 21,
        completionRate: 86,
        sessionsThisMonth: 5,
        sessionsLastMonth: 4,
        currentStreak: 3,
        longestStreak: 7,
        mostCommonDay: 1,
        mostCommonTimeSlot: 'afternoon',
        averageDuration: 70,
        durationBreakdown: [
          { duration: 45, count: 4 },
          { duration: 60, count: 10 },
          { duration: 90, count: 4 },
        ],
        monthlyTrend: [
          { month: 'Jan', count: 3 },
          { month: 'Feb', count: 4 },
          { month: 'Mar', count: 6 },
          { month: 'Apr', count: 5 },
        ],
      } satisfies TClientStats) as T;
    }
    if (path === '/api/admin/stats') {
      return clone({
        totalBookings: 64,
        activeClients: 14,
        completionRate: 91,
        bookingsThisMonth: 22,
        bookingsLastMonth: 18,
        totalClients: state.clients.length,
        newClientsThisMonth: 3,
        topClients: state.clients.slice(0, 3).map((client, index) => ({
          name: client.displayName || client.name,
          count: 8 - index * 2,
          photoUrl: client.photoUrl,
        })),
        returningRate: 74,
        busiestDay: 3,
        busiestTimeSlot: 'afternoon',
        avgBookingsPerWeek: 9.5,
        cancellationRate: 7,
        revenueThisMonth: 84000,
        revenueLastMonth: 72000,
        revenueCurrency: 'RUB',
        revenueByMonth: [
          { month: 'Jan', revenue: 52000 },
          { month: 'Feb', revenue: 66000 },
          { month: 'Mar', revenue: 72000 },
          { month: 'Apr', revenue: 84000 },
        ],
        revenueByService: state.services.map((service, index) => ({
          name: service.name,
          revenue: [54000, 21000, 9000][index] ?? 0,
        })),
      } satisfies TAdminStats) as T;
    }
    if (path === '/api/changes') {
      return clone(state.changeVersions) as T;
    }
    if (path === '/api/profile') {
      return clone(state.clientProfile) as T;
    }
    if (path === '/api/recurring' || path === '/api/admin/recurring') {
      return clone(state.recurringSchedules) as T;
    }
    if (path === '/api/admin/profile') {
      return clone(state.adminProfile) as T;
    }
    if (path === '/api/admin/clients') {
      return clone(state.clients) as T;
    }
    if (path === '/api/admin/notifications') {
      return clone(state.adminNotifications) as T;
    }

    const clientRecurringDetailMatch = path.match(/^\/api\/recurring\/([^/]+)$/);
    if (clientRecurringDetailMatch) {
      return clone(getSchedule(state, clientRecurringDetailMatch[1])) as T;
    }

    const adminRecurringDetailMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)$/);
    if (adminRecurringDetailMatch) {
      return clone(getSchedule(state, adminRecurringDetailMatch[1])) as T;
    }
  }

  if (method === 'POST') {
    if (path === '/api/bookings') {
      return createBookingFromBody(state, body, 'client') as T;
    }
    if (path === '/api/admin/bookings') {
      return createBookingFromBody(state, body, 'specialist') as T;
    }
    if (path === '/api/recurring/preview' || path === '/api/admin/recurring/preview') {
      const dates = buildPreviewDates(getRecord(body.dayTimes));
      return clone({ dates, count: dates.length } satisfies TRecurringPreviewResponse) as T;
    }
    if (path === '/api/recurring') {
      return createRecurringSchedule(state, body, 'client') as T;
    }
    if (path === '/api/admin/recurring') {
      return createRecurringSchedule(state, body, 'specialist') as T;
    }
    if (path === '/api/admin/services') {
      const service: TSessionType = {
        id: `mock-service-${Date.now()}`,
        type: getString(body.type, 'personal'),
        name: getString(body.name, 'New service'),
        durationMinutes: getNumber(body.durationMinutes, 60),
        price: getNumber(body.price, 0),
        currency: getString(body.currency, 'RUB'),
        imageUrl: getOptionalString(body.imageUrl),
      };
      state.services = [service, ...state.services];
      bumpChangeVersions(state, ['services']);
      return clone(service) as T;
    }
    if (path === '/api/admin/days-off') {
      const dayOff: TDayOff = {
        id: `mock-day-off-${Date.now()}`,
        date: getString(body.date, dateString(1)),
        reason: getOptionalString(body.reason),
        createdAt: new Date().toISOString(),
      };
      state.daysOff = [dayOff, ...state.daysOff];
      bumpChangeVersions(state, ['daysOff']);
      return clone(dayOff) as T;
    }
    if (path === '/api/admin/clients') {
      const client: TClientInfo = {
        id: `mock-client-${Date.now()}`,
        telegramUserId: 0,
        specialistId: state.adminProfile.id,
        name: getString(body.name, 'Guest client'),
        isGhost: true,
        createdAt: new Date().toISOString(),
      };
      state.clients = [client, ...state.clients];
      bumpChangeVersions(state, ['clients']);
      return clone(client) as T;
    }
    if (path === '/api/upload/photo' || path === '/api/admin/upload/photo') {
      return clone({ fileId: mockPhotoDataUrl }) as T;
    }

    const moveMatch = path.match(/^\/api\/recurring\/([^/]+)\/bookings\/([^/]+)\/move$/);
    if (moveMatch) {
      return updateBooking(state, moveMatch[2], (booking) => ({
        ...booking,
        status: 'reschedule_pending',
      })) as T;
    }

    const adminMoveMatch = path.match(
      /^\/api\/admin\/recurring\/([^/]+)\/bookings\/([^/]+)\/move$/,
    );
    if (adminMoveMatch) {
      return updateBooking(state, adminMoveMatch[2], (booking) => ({
        ...booking,
        status: 'reschedule_pending',
      })) as T;
    }
  }

  if (method === 'PUT') {
    if (path === '/api/profile') {
      state.clientProfile = { ...state.clientProfile, ...(body as Partial<TClientProfile>) };
      bumpChangeVersions(state, ['clientProfile']);
      return clone(state.clientProfile) as T;
    }
    if (path === '/api/profile/notifications') {
      state.clientProfile = { ...state.clientProfile, ...(body as Partial<TClientProfile>) };
      bumpChangeVersions(state, ['clientProfile']);
      return clone(state.clientProfile) as T;
    }
    if (path === '/api/admin/profile') {
      state.adminProfile = { ...state.adminProfile, ...(body as Partial<TSpecialist>) };
      bumpChangeVersions(state, ['specialist']);
      return clone(state.adminProfile) as T;
    }
    if (path === '/api/admin/working-hours') {
      const hours = Array.isArray(body.hours) ? (body.hours as TWorkingHours[]) : [];
      state.workingHours = clone(hours);
      bumpChangeVersions(state, ['workingHours']);
      return clone(state.workingHours) as T;
    }
    if (path === '/api/admin/notifications') {
      state.adminNotifications = {
        ...state.adminNotifications,
        ...(body as Partial<TAdminNotifications>),
      };
      bumpChangeVersions(state, ['adminNotifications']);
      return clone(state.adminNotifications) as T;
    }

    const clientConfirmMatch = path.match(/^\/api\/bookings\/([^/]+)\/confirm$/);
    if (clientConfirmMatch) {
      return updateBooking(state, clientConfirmMatch[1], (booking) => ({
        ...booking,
        status: 'confirmed',
      })) as T;
    }

    const clientDeclineMatch = path.match(/^\/api\/bookings\/([^/]+)\/decline$/);
    if (clientDeclineMatch) {
      return updateBooking(state, clientDeclineMatch[1], (booking) => ({
        ...booking,
        status: 'rejected',
      })) as T;
    }

    const adminBookingStatusMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)\/status$/);
    if (adminBookingStatusMatch) {
      return updateBooking(state, adminBookingStatusMatch[1], (booking) => ({
        ...booking,
        status: getString(body.status, booking.status) as TBooking['status'],
        cancelReason: getOptionalString(body.reason),
      })) as T;
    }

    const adminRescheduleMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)\/reschedule$/);
    if (adminRescheduleMatch) {
      const date = getString(body.date, dateString(1));
      const time = getString(body.time, '10:00');
      const startsAt = `${date}T${time}:00Z`;
      return updateBooking(state, adminRescheduleMatch[1], (booking) => ({
        ...booking,
        startsAt,
        endsAt: addMinutesToISO(startsAt, booking.durationMinutes ?? 60),
      })) as T;
    }

    const serviceMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
    if (serviceMatch) {
      let updated: TSessionType | null = null;
      state.services = state.services.map((service) => {
        if (service.id !== serviceMatch[1]) {
          return service;
        }
        updated = { ...service, ...(body as Partial<TSessionType>) };
        return updated;
      });
      if (!updated) {
        throw new Error('Mock service not found');
      }
      bumpChangeVersions(state, ['services']);
      return clone(updated) as T;
    }

    const workingHoursDayMatch = path.match(/^\/api\/admin\/working-hours\/(\d+)$/);
    if (workingHoursDayMatch) {
      const intervals = Array.isArray(body.hours)
        ? (body.hours as { startTime: string; endTime: string }[])
        : [];
      return updateWorkingHoursForDay(state, Number(workingHoursDayMatch[1]), intervals) as T;
    }

    const clientMatch = path.match(/^\/api\/admin\/clients\/([^/]+)$/);
    if (clientMatch) {
      let updated: TClientInfo | null = null;
      state.clients = state.clients.map((client) => {
        if (client.id !== clientMatch[1]) {
          return client;
        }
        updated = {
          ...client,
          name: getString(body.name, client.name),
          displayName: client.isGhost
            ? undefined
            : (getOptionalString(body.name) ?? client.displayName),
        };
        return updated;
      });
      if (!updated) {
        throw new Error('Mock client not found');
      }
      bumpChangeVersions(state, ['clients', 'bookings', 'recurring']);
      return clone(updated) as T;
    }

    const adminApproveScheduleMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)\/approve$/);
    if (adminApproveScheduleMatch) {
      return updateSchedule(state, adminApproveScheduleMatch[1], (schedule) => ({
        ...schedule,
        status: 'active',
      })) as T;
    }

    const adminDeclineScheduleMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)\/decline$/);
    if (adminDeclineScheduleMatch) {
      return updateSchedule(state, adminDeclineScheduleMatch[1], (schedule) => ({
        ...schedule,
        status: 'declined',
      })) as T;
    }

    const cancelRequestMatch = path.match(
      /^\/api\/(?:admin\/)?recurring\/([^/]+)\/bookings\/([^/]+)\/cancel-request$/,
    );
    if (cancelRequestMatch) {
      return updateBooking(state, cancelRequestMatch[2], (booking) => ({
        ...booking,
        status: 'cancel_requested',
      })) as T;
    }

    const approveMoveMatch = path.match(
      /^\/api\/admin\/recurring\/([^/]+)\/bookings\/([^/]+)\/approve-move$/,
    );
    if (approveMoveMatch) {
      return updateBooking(state, approveMoveMatch[2], (booking) => ({
        ...booking,
        status: 'confirmed',
      })) as T;
    }

    const declineMoveMatch = path.match(
      /^\/api\/admin\/recurring\/([^/]+)\/bookings\/([^/]+)\/decline-move$/,
    );
    if (declineMoveMatch) {
      updateBooking(state, declineMoveMatch[2], (booking) => ({
        ...booking,
        status: 'confirmed',
      }));
      return undefined as T;
    }
  }

  if (method === 'DELETE') {
    const clientBookingMatch = path.match(/^\/api\/bookings\/([^/]+)$/);
    if (clientBookingMatch) {
      return updateBooking(state, clientBookingMatch[1], (booking) => ({
        ...booking,
        status: 'cancelled',
        cancelReason: getOptionalString(body.reason),
        cancelledBy: 'client',
      })) as T;
    }

    const serviceMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
    if (serviceMatch) {
      state.services = state.services.filter((service) => service.id !== serviceMatch[1]);
      bumpChangeVersions(state, ['services']);
      return undefined as T;
    }

    const workingHoursDayMatch = path.match(/^\/api\/admin\/working-hours\/(\d+)$/);
    if (workingHoursDayMatch) {
      state.workingHours = state.workingHours.filter(
        (item) => item.dayOfWeek !== Number(workingHoursDayMatch[1]),
      );
      bumpChangeVersions(state, ['workingHours']);
      return undefined as T;
    }

    const dayOffMatch = path.match(/^\/api\/admin\/days-off\/([^/]+)$/);
    if (dayOffMatch) {
      state.daysOff = state.daysOff.filter((dayOff) => dayOff.id !== dayOffMatch[1]);
      bumpChangeVersions(state, ['daysOff']);
      return undefined as T;
    }

    const clientMatch = path.match(/^\/api\/admin\/clients\/([^/]+)$/);
    if (clientMatch) {
      state.clients = state.clients.filter((client) => client.id !== clientMatch[1]);
      bumpChangeVersions(state, ['clients', 'bookings', 'recurring']);
      return undefined as T;
    }

    const recurringMatch = path.match(/^\/api\/(?:admin\/)?recurring\/([^/]+)$/);
    if (recurringMatch) {
      updateSchedule(state, recurringMatch[1], (schedule) => ({
        ...schedule,
        status: 'cancelled',
      }));
      return undefined as T;
    }
  }

  const fallbackBooking = path.match(/^\/api\/admin\/bookings\/([^/]+)$/);
  if (fallbackBooking) {
    const booking = findBooking(state, fallbackBooking[1]);
    if (booking) {
      return clone(booking) as T;
    }
  }

  throw new Error(`Mock API endpoint not implemented: ${method} ${endpoint}`);
}
