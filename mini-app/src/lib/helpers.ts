import type { TBooking, TSpecialist, TWorkingHours } from './types';

/***************************************************************************************************
 * Parses day times.
 *
 * Parameters:
 * - dayTimesJSON: Time value used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as Record<string, string> | null.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function parseDayTimes(dayTimesJSON?: string): Record<string, string> | null {
  if (!dayTimesJSON) {
    return null;
  }
  try {
    return JSON.parse(dayTimesJSON);
  } catch {
    return null;
  }
}

/***************************************************************************************************
 * Formats time.
 *
 * Parameters:
 * - isoStr: Boolean flag that influences the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function formatTime(isoStr: string): string {
  /***************************************************************************************************
   * Defines the d value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const d = new Date(isoStr);
  /***************************************************************************************************
   * Defines the h value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const h = String(d.getUTCHours()).padStart(2, '0');
  /***************************************************************************************************
   * Defines the m value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/***************************************************************************************************
 * Formats date iso.
 *
 * Parameters:
 * - date: Date value used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/***************************************************************************************************
 * Formats duration.
 *
 * Parameters:
 * - minutes: Minutes used by the current operation.
 * - hourLabel: Hour label used by the current operation.
 * - minuteLabel: Minute label used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function formatDuration(minutes: number, hourLabel = 'h', minuteLabel = 'min'): string {
  /***************************************************************************************************
   * Defines the hours value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const hours = minutes / 60;
  if (minutes < 60 || minutes % 30 !== 0) {
    return `${minutes} ${minuteLabel}`;
  }
  if (hours === Math.floor(hours)) {
    return `${Math.floor(hours)} ${hourLabel}`;
  }
  return `${hours.toFixed(1).replace('.0', '')} ${hourLabel}`;
}

/***************************************************************************************************
 * Implements the add minutes to time logic used by this module.
 *
 * Parameters:
 * - time: Time value used by the current operation.
 * - minutes: Minutes used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  /***************************************************************************************************
   * Defines the total value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/***************************************************************************************************
 * Returns non working days.
 *
 * Parameters:
 * - workingHours: Working hours used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as number[].
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getNonWorkingDays(workingHours: TWorkingHours[]): number[] {
  /***************************************************************************************************
   * Defines the working day set value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const workingDaySet = new Set(workingHours.map((wh) => wh.dayOfWeek));
  const result: number[] = [];
  for (let day = 0; day < 7; day++) {
    if (!workingDaySet.has(day)) {
      result.push(day);
    }
  }
  return result;
}

/***************************************************************************************************
 * Implements the generate time slots for day logic used by this module.
 *
 * Parameters:
 * - workingHours: Working hours used by the current operation.
 * - day: Day used by the current operation.
 * - durationMinutes: Duration value used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string[].
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function generateTimeSlotsForDay(
  workingHours: TWorkingHours[],
  day: number,
  durationMinutes: number,
): string[] {
  if (durationMinutes <= 0) {
    return [];
  }
  const dayWorkingHours = workingHours.filter((h) => h.dayOfWeek === day);
  if (dayWorkingHours.length === 0) {
    return [];
  }
  const slots = new Set<string>();

  for (const wh of dayWorkingHours) {
    const [startH, startM] = wh.startTime.split(':').map(Number);
    const [endH, endM] = wh.endTime.split(':').map(Number);
    /***************************************************************************************************
     * Defines the start min value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const startMin = startH * 60 + startM;
    /***************************************************************************************************
     * Defines the end min value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const endMin = endH * 60 + endM;
    for (let m = startMin; m + durationMinutes <= endMin; m += durationMinutes) {
      /***************************************************************************************************
       * Defines the h value used by the shared utility layer.
       *
       * Usage context:
       * - Reused by the shared utility layer to keep shared values centralized.
       ***************************************************************************************************/
      const h = Math.floor(m / 60);
      /***************************************************************************************************
       * Defines the min value used by the shared utility layer.
       *
       * Usage context:
       * - Reused by the shared utility layer to keep shared values centralized.
       ***************************************************************************************************/
      const min = m % 60;
      slots.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
  }

  return Array.from(slots).sort();
}

export function parseDateParam(raw: string | null): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return undefined;
  }
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  /***************************************************************************************************
   * Guard against silent overflow normalization (e.g. 2026-02-31 → 2026-03-03).
   ***************************************************************************************************/
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return undefined;
  }
  return date;
}

export function nextDateForWeekday(targetDay: number, today: Date): Date {
  const delta = (targetDay - today.getDay() + 7) % 7;
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta);
  return next;
}

export function wallClockNow(): number {
  return Date.now() - new Date().getTimezoneOffset() * 60000;
}

/***************************************************************************************************
 * Collapses reschedule_pending shadow bookings over their originals.
 *
 * When a reschedule is proposed, a shadow booking (status='reschedule_pending') is created
 * that references the original via `replacesBookingId`. Showing both side-by-side confuses
 * the user — this helper hides the original from the visible list and builds a lookup map so
 * each shadow card can display the old→new time change.
 *
 * Parameters:
 * - bookings: The full flat list of bookings to process.
 *
 * Returns:
 * - visible: The list with originals superseded by their shadows removed.
 * - replacedLookup: Map from replacesBookingId → original booking (for old→new display).
 ***************************************************************************************************/
export function collapseReschedulePending(bookings: TBooking[]): {
  visible: TBooking[];
  replacedLookup: Map<string, TBooking>;
} {
  const idToBooking = new Map<string, TBooking>(bookings.map((b) => [b.id, b]));
  const replacedIds = new Set<string>(
    bookings
      .filter((b) => b.status === 'reschedule_pending' && b.replacesBookingId)
      .map((b) => b.replacesBookingId as string),
  );
  const replacedLookup = new Map<string, TBooking>();
  for (const id of replacedIds) {
    const original = idToBooking.get(id);
    if (original) {
      replacedLookup.set(id, original);
    }
  }
  return {
    visible: bookings.filter((b) => !replacedIds.has(b.id)),
    replacedLookup,
  };
}

export function clientEntityLabel(
  entity: { clientIsSelf?: boolean; clientDisplayName?: string; clientName?: string },
  selfLabel: string,
): string {
  return entity.clientIsSelf ? selfLabel : entity.clientDisplayName || entity.clientName || '';
}

export function isWithinCutoff(
  booking: TBooking,
  specialist: Pick<TSpecialist, 'cancelCutoffEnabled' | 'cancelCutoffHours'> | null | undefined,
): boolean {
  if (!specialist?.cancelCutoffEnabled) {
    return false;
  }
  const msUntil = new Date(booking.startsAt).getTime() - wallClockNow();
  return msUntil > 0 && msUntil < (specialist.cancelCutoffHours ?? 24) * 60 * 60 * 1000;
}
