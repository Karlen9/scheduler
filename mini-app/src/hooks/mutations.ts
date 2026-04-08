import { mutate } from 'swr';

import { CACHE_KEYS } from './cache-keys';

/***************************************************************************************************
 * Implements the invalidate bookings logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateBookings(): void {
  mutate(CACHE_KEYS.bookings);
  mutate(CACHE_KEYS.adminBookings);
}

/***************************************************************************************************
 * Implements the invalidate working hours logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateWorkingHours(): void {
  mutate(CACHE_KEYS.workingHours);
  mutate(CACHE_KEYS.scheduleContext);
  mutate(CACHE_KEYS.adminWorkingHours);
  mutate(CACHE_KEYS.adminScheduleContext);
}

/***************************************************************************************************
 * Implements the invalidate days off logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateDaysOff(): void {
  mutate(CACHE_KEYS.daysOff);
  mutate(CACHE_KEYS.scheduleContext);
  mutate(CACHE_KEYS.adminDaysOff);
  mutate(CACHE_KEYS.adminScheduleContext);
}

/***************************************************************************************************
 * Implements the invalidate services logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateServices(): void {
  mutate(CACHE_KEYS.sessionTypes);
  mutate(CACHE_KEYS.adminServices);
}

/***************************************************************************************************
 * Implements the invalidate specialist logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateSpecialist(): void {
  mutate(CACHE_KEYS.specialist);
  mutate(CACHE_KEYS.adminProfile);
}

/***************************************************************************************************
 * Implements the invalidate profile logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateProfile(): void {
  mutate(CACHE_KEYS.profile);
}

/***************************************************************************************************
 * Implements the invalidate recurring logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateRecurring(): void {
  mutate(CACHE_KEYS.recurringSchedules);
  mutate(CACHE_KEYS.adminRecurringSchedules);
  /***************************************************************************************************
   * Invalidate all detail keys by matching prefix.
   ***************************************************************************************************/
  mutate(
    (key: string) =>
      typeof key === 'string' &&
      (key.startsWith('recurringDetail:') || key.startsWith('adminRecurringDetail:')),
    undefined,
    { revalidate: true },
  );
  invalidateBookings();
}

/***************************************************************************************************
 * Implements the invalidate clients logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateClients(): void {
  mutate(CACHE_KEYS.adminClients);
}

/***************************************************************************************************
 * Implements the invalidate admin notifications logic used by this module.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as void.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function invalidateAdminNotifications(): void {
  mutate(CACHE_KEYS.adminNotifications);
}
