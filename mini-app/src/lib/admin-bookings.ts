import type { TBooking } from './types';

export const ADMIN_UPCOMING_BOOKING_STATUSES: TBooking['status'][] = [
  'pending',
  'confirmed',
  'cancel_requested',
  'reschedule_pending',
];

export const ADMIN_BOOKING_STATUS_OPTIONS: TBooking['status'][] = [
  ...ADMIN_UPCOMING_BOOKING_STATUSES,
  'completed',
  'cancelled',
  'rejected',
];

function localISODate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
  return localISODate();
}

export function yesterdayISO(): string {
  return localISODate(-1);
}
