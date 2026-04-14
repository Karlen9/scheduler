import { getDataScope } from '@/lib/routes';

function scopedKey(key: string): string {
  const scope = getDataScope();
  return scope === 'live' ? key : `${scope}:${key}`;
}

/***************************************************************************************************
 * Static data keys.
 *
 * Usage context:
 * - Reused by the hook layer to keep shared values centralized.
 ***************************************************************************************************/
export const CACHE_KEYS = {
  get specialist(): string {
    return scopedKey('specialist');
  },
  get workingHours(): string {
    return scopedKey('workingHours');
  },
  get scheduleContext(): string {
    return scopedKey('scheduleContext');
  },
  get daysOff(): string {
    return scopedKey('daysOff');
  },
  get sessionTypes(): string {
    return scopedKey('sessionTypes');
  },
  get profile(): string {
    return scopedKey('profile');
  },
  get bookings(): string {
    return scopedKey('bookings');
  },
  get clientStats(): string {
    return scopedKey('clientStats');
  },
  get recurringSchedules(): string {
    return scopedKey('recurringSchedules');
  },
  recurringDetail: (id: string) => scopedKey(`recurringDetail:${id}`),
  get changeVersions(): string {
    return scopedKey('changeVersions');
  },

  /***************************************************************************************************
   * Admin keys.
   ***************************************************************************************************/
  get adminBookings(): string {
    return scopedKey('adminBookings');
  },
  get adminStats(): string {
    return scopedKey('adminStats');
  },
  get adminClients(): string {
    return scopedKey('adminClients');
  },
  get adminProfile(): string {
    return scopedKey('adminProfile');
  },
  get adminServices(): string {
    return scopedKey('adminServices');
  },
  get adminWorkingHours(): string {
    return scopedKey('adminWorkingHours');
  },
  get adminScheduleContext(): string {
    return scopedKey('adminScheduleContext');
  },
  get adminDaysOff(): string {
    return scopedKey('adminDaysOff');
  },
  get adminNotifications(): string {
    return scopedKey('adminNotifications');
  },
  get adminRecurringSchedules(): string {
    return scopedKey('adminRecurringSchedules');
  },
  adminRecurringDetail: (id: string) => scopedKey(`adminRecurringDetail:${id}`),
};
