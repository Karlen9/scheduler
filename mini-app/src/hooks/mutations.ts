import { mutate } from 'swr';

import { CACHE_KEYS } from './cache-keys';

export function invalidateBookings(): void {
  mutate(CACHE_KEYS.bookings);
  mutate(CACHE_KEYS.adminBookings);
}

export function invalidateWorkingHours(): void {
  mutate(CACHE_KEYS.workingHours);
  mutate(CACHE_KEYS.adminWorkingHours);
}

export function invalidateDaysOff(): void {
  mutate(CACHE_KEYS.daysOff);
  mutate(CACHE_KEYS.adminDaysOff);
}

export function invalidateServices(): void {
  mutate(CACHE_KEYS.sessionTypes);
  mutate(CACHE_KEYS.adminServices);
  mutate(CACHE_KEYS.durations);
}

export function invalidateSpecialist(): void {
  mutate(CACHE_KEYS.specialist);
  mutate(CACHE_KEYS.adminProfile);
}

export function invalidateProfile(): void {
  mutate(CACHE_KEYS.profile);
}

export function invalidateRecurring(): void {
  mutate(CACHE_KEYS.recurringSchedules);
  mutate(CACHE_KEYS.adminRecurringSchedules);
  // Invalidate all detail keys by matching prefix
  mutate(
    (key: string) =>
      typeof key === 'string' &&
      (key.startsWith('recurringDetail:') || key.startsWith('adminRecurringDetail:')),
    undefined,
    { revalidate: true },
  );
  invalidateBookings();
}

export function invalidateClients(): void {
  mutate(CACHE_KEYS.adminClients);
}

export function invalidateAdminNotifications(): void {
  mutate(CACHE_KEYS.adminNotifications);
}
