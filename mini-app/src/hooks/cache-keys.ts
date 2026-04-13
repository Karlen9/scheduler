/***************************************************************************************************
 * Static data keys.
 *
 * Usage context:
 * - Reused by the hook layer to keep shared values centralized.
 ***************************************************************************************************/
export const CACHE_KEYS = {
  specialist: 'specialist',
  workingHours: 'workingHours',
  scheduleContext: 'scheduleContext',
  daysOff: 'daysOff',
  sessionTypes: 'sessionTypes',
  profile: 'profile',
  bookings: 'bookings',
  clientStats: 'clientStats',
  recurringSchedules: 'recurringSchedules',
  recurringDetail: (id: string) => `recurringDetail:${id}`,
  changeVersions: 'changeVersions',

  /***************************************************************************************************
   * Admin keys.
   ***************************************************************************************************/
  adminBookings: 'adminBookings',
  adminStats: 'adminStats',
  adminClients: 'adminClients',
  adminProfile: 'adminProfile',
  adminServices: 'adminServices',
  adminWorkingHours: 'adminWorkingHours',
  adminScheduleContext: 'adminScheduleContext',
  adminDaysOff: 'adminDaysOff',
  adminNotifications: 'adminNotifications',
  adminRecurringSchedules: 'adminRecurringSchedules',
  adminRecurringDetail: (id: string) => `adminRecurringDetail:${id}`,
};
