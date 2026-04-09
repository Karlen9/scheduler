import type { TWorkingHours } from './types';

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
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function formatDuration(minutes: number, hourLabel = 'h'): string {
  /***************************************************************************************************
   * Defines the hours value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const hours = minutes / 60;
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
    for (let m = startMin; m + durationMinutes <= endMin; m += 30) {
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
