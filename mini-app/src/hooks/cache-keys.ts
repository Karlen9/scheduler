// Static data keys
export const CACHE_KEYS = {
  trainer: 'trainer',
  workingHours: 'workingHours',
  daysOff: 'daysOff',
  durations: 'durations',
  sessionTypes: 'sessionTypes',
  profile: 'profile',
  bookings: 'bookings',
  recurringSchedules: 'recurringSchedules',
  recurringDetail: (id: string) => `recurringDetail:${id}`,

  // Admin keys
  adminBookings: 'adminBookings',
  adminClients: 'adminClients',
  adminProfile: 'adminProfile',
  adminServices: 'adminServices',
  adminWorkingHours: 'adminWorkingHours',
  adminDaysOff: 'adminDaysOff',
  adminNotifications: 'adminNotifications',
  adminRecurringSchedules: 'adminRecurringSchedules',
  adminRecurringDetail: (id: string) => `adminRecurringDetail:${id}`,
};
