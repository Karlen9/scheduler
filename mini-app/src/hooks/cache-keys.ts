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
  recurringSchedules: 'recurringSchedules',
  recurringDetail: (id: string) => `recurringDetail:${id}`,

  /***************************************************************************************************
   * Admin keys.
   ***************************************************************************************************/
  adminBookings: 'adminBookings',
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
