import { mutate } from "swr";
import { CACHE_KEYS } from "./cache-keys";

export function invalidateBookings() {
  mutate(CACHE_KEYS.bookings);
  mutate(CACHE_KEYS.adminBookings);
}

export function invalidateWorkingHours() {
  mutate(CACHE_KEYS.workingHours);
  mutate(CACHE_KEYS.adminWorkingHours);
}

export function invalidateDaysOff() {
  mutate(CACHE_KEYS.daysOff);
  mutate(CACHE_KEYS.adminDaysOff);
}

export function invalidateServices() {
  mutate(CACHE_KEYS.sessionTypes);
  mutate(CACHE_KEYS.adminServices);
  mutate(CACHE_KEYS.durations);
}

export function invalidateTrainer() {
  mutate(CACHE_KEYS.trainer);
  mutate(CACHE_KEYS.adminProfile);
}

export function invalidateProfile() {
  mutate(CACHE_KEYS.profile);
}

export function invalidateRecurring() {
  mutate(CACHE_KEYS.recurringSchedules);
  mutate(CACHE_KEYS.adminRecurringSchedules);
  // Invalidate all detail keys by matching prefix
  mutate(
    (key: string) =>
      typeof key === "string" &&
      (key.startsWith("recurringDetail:") ||
        key.startsWith("adminRecurringDetail:")),
    undefined,
    { revalidate: true },
  );
  invalidateBookings();
}

export function invalidateClients() {
  mutate(CACHE_KEYS.adminClients);
}

export function invalidateAdminNotifications() {
  mutate(CACHE_KEYS.adminNotifications);
}
