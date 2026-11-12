import {
  createBookings,
  createClientBatches,
  createDaysOff,
  createPlanner,
  createRecurringSchedules,
  fillBookings,
} from './fixtures-bookings';
import { createClients } from './fixtures-clients';
import { createServices } from './fixtures-services';
import { createInitialChangeVersions } from './utils';

import type { TSpecialist, TWorkingHours } from '../types';
import type { TMockState } from './types';

export function createMockState(): TMockState {
  const services = createServices();
  const [personal, mobility, consult, relax, neck] = services;
  const serviceMap = { personal, mobility, consult, relax, neck };
  const { clients, byKey } = createClients();

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

  const daysOff = createDaysOff();
  const planner = createPlanner(daysOff);
  const recurringSchedules = createRecurringSchedules(planner, byKey, serviceMap);
  const namedBookings = createBookings(planner, byKey, serviceMap);
  const bookings = fillBookings(planner, byKey, serviceMap, namedBookings);

  const specialistBase: TSpecialist = {
    id: 'mock-specialist',
    name: 'Карлен Мисакян',
    timezone: 'Europe/Moscow',
    cancelCutoffHours: 12,
    botUsername: 'karlen_massage_bot',
    telegramHandle: '@karlen_massage',
    phone: '+7 916 555-44-33',
    specialization: 'Массажист и специалист по восстановлению',
    bio: 'Помогаю снять напряжение в спине и шее, улучшить осанку и вернуть лёгкость в теле. Индивидуальный подход, опыт работы более 8 лет. Приём по записи в центре Москвы.',
    wallpaper: 'fitness',
    referralCode: 'a3f9c2e81b7d4f06',
    language: 'ru',
  };

  return {
    adminNotifications: {
      notifyNewBookings: true,
      notifyCancellations: true,
    },
    adminProfile: {
      ...specialistBase,
      isOwner: true,
      masterBotUsername: 'schedu1erbot',
    },
    bookings,
    changeVersions: createInitialChangeVersions(),
    clientProfile: {
      id: 'mock-profile',
      name: byKey.elena.name,
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
    clientBatches: createClientBatches(byKey, serviceMap),
    clients,
    daysOff,
    recurringSchedules,
    services,
    workingHours,
  };
}
