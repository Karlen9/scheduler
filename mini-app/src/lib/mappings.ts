export const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const monthGenKeys = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export const scheduleStatusKeys: Record<string, string> = {
  pending: 'pending',
  active: 'active',
  declined: 'declined',
  cancelled: 'cancelled',
};

export const bookingStatusColors: Record<string, string> = {
  pending: 'bg-status-pending-bg text-status-pending-text',
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  rejected: 'bg-status-rejected-bg text-status-rejected-text',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled-text',
  completed: 'bg-status-completed-bg text-status-completed-text',
  cancel_requested: 'bg-status-warning-bg text-status-warning-text',
  reschedule_pending: 'bg-status-purple-bg text-status-purple-text',
};

export const bookingStatusKeys: Record<string, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancel_requested: 'cancelRequested',
  reschedule_pending: 'reschedulePending',
};

export const dayKeyMap: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};
export const monthShortCapKeys = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];
