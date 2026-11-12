import type {
  TBooking,
  TChangeGroup,
  TChangeVersions,
  TClientBatch,
  TClientInfo,
  TClientProfile,
  TDayOff,
  TRecurringSchedule,
  TScheduleMode,
  TSessionType,
  TSpecialist,
  TWorkingHours,
  TWorkingInterval,
} from '../types';
import type { TMockRoom, TMockScenario, TMockWorkDates } from './room-types';

export type TAdminNotifications = {
  notifyNewBookings: boolean;
  notifyCancellations: boolean;
  notifyWorkDaysReminder?: boolean;
};

export type TMockState = {
  adminNotifications: TAdminNotifications;
  adminProfile: TSpecialist;
  bookings: TBooking[];
  changeVersions: TChangeVersions;
  clientProfile: TClientProfile;
  clientSpecialist: TSpecialist;
  clientBatches: TClientBatch[];
  clients: TClientInfo[];
  daysOff: TDayOff[];
  recurringSchedules: TRecurringSchedule[];
  services: TSessionType[];
  workingHours: TWorkingHours[];
  /** Optional scenario fields: absent (weekly schedule, no room) in the default scenario. */
  scenario?: TMockScenario;
  scheduleMode?: TScheduleMode;
  defaultIntervals?: TWorkingInterval[];
  workDates?: TMockWorkDates;
  room?: TMockRoom | null;
};

export const changeGroups: TChangeGroup[] = [
  'bookings',
  'recurring',
  'clients',
  'services',
  'clientBatches',
  'workingHours',
  'daysOff',
  'specialist',
  'clientProfile',
  'adminNotifications',
  'room',
];
