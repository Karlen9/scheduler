import type {
  TBooking,
  TChangeGroup,
  TChangeVersions,
  TClientBatch,
  TClientInfo,
  TClientProfile,
  TDayOff,
  TRecurringSchedule,
  TSessionType,
  TSpecialist,
  TSubscription,
  TWorkingHours,
} from '../types';

export type TAdminNotifications = {
  notifyNewBookings: boolean;
  notifyCancellations: boolean;
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
  subscription: TSubscription;
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
];

export const mockPhotoDataUrl =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
