import { buildBooking, createInitialChangeVersions, dateString, isoAt } from './utils';

import type {
  TBooking,
  TClientBatch,
  TClientInfo,
  TDayOff,
  TRecurringSchedule,
  TSessionType,
  TSpecialist,
  TWorkingHours,
} from '../types';
import type { TMockState } from './types';

export function createMockState(): TMockState {
  const services: TSessionType[] = [
    {
      id: 'mock-service-personal',
      type: 'common',
      name: 'Personal training',
      durationMinutes: 60,
      price: 3500,
      currency: 'RUB',
    },
    {
      id: 'mock-service-mobility',
      type: 'batch',
      name: 'Mobility session',
      durationMinutes: 45,
      price: 10000,
      currency: 'RUB',
      sessionsCount: 10,
    },
    {
      id: 'mock-service-consultation',
      type: 'common',
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
      telegramUsername: 'anna_morozova',
      specialistId: 'mock-specialist',
      name: 'Anna Morozova',
      displayName: 'Anna',
      phone: '+7 900 111-22-33',
      createdAt: isoAt(-80, '09:00'),
    },
    {
      id: 'mock-client-ivan',
      telegramUserId: 102,
      telegramUsername: 'ivan_petrov',
      specialistId: 'mock-specialist',
      name: 'Ivan Petrov',
      displayName: 'Ivan P.',
      phone: '+7 900 222-33-44',
      createdAt: isoAt(-35, '09:00'),
    },
    {
      id: 'mock-client-maria',
      telegramUserId: 103,
      telegramUsername: 'maria_volkova',
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

  const testClient: TClientInfo = {
    id: 'mock-profile',
    telegramUserId: 999,
    specialistId: 'mock-specialist',
    name: 'Test Client',
    displayName: 'Test Client',
    phone: '+7 900 777-66-55',
    createdAt: isoAt(-100, '09:00'),
  };
  clients.push(testClient);

  const bookings: TBooking[] = [
    buildBooking({
      id: 'mock-booking-test-client-confirmed',
      client: testClient,
      service: services[0],
      days: 2,
      time: '14:00',
      status: 'confirmed',
      createdBy: 'client',
    }),
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
      id: 'mock-booking-confirmed-2',
      client: clients[2],
      service: services[2],
      days: 7,
      time: '11:00',
      status: 'confirmed',
      createdBy: 'client',
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
    name: 'Карлен Мисакян',
    timezone: 'Europe/Moscow',
    cancelCutoffHours: 12,
    botUsername: 'mock_scheduler_bot',
    telegramHandle: '@alex_trains',
    phone: '+7 900 555-44-33',
    specialization: 'Strength and mobility coach',
    bio: 'Focused strength work, posture, mobility, and habit-based progress for busy clients.',
    wallpaper: 'fitness',
  };

  const clientBatches: TClientBatch[] = [
    {
      id: 'mock-client-batch-active',
      clientId: 'mock-profile',
      serviceId: services[1].id,
      totalSessions: 10,
      remainingSessions: 7,
      createdAt: new Date().toISOString(),
      status: 'active',
      service: services[1],
    },
  ];

  const daysOff: TDayOff[] = [
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
  ];

  return {
    adminNotifications: {
      notifyNewBookings: true,
      notifyCancellations: true,
    },
    adminProfile: {
      ...specialistBase,
      isOwner: true,
      masterBotUsername: 'masterbot',
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
    clientBatches,
    clients,
    daysOff,
    recurringSchedules,
    services,
    workingHours,
  };
}
