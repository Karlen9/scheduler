import type { TWorkingInterval } from './types';

export const MAX_INTERVALS = 4;
const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const STEP_MINUTES = 30;

export const DEFAULT_WORK_INTERVAL: TWorkingInterval = { startTime: '10:00', endTime: '20:00' };

export type TIntervalsErrorKey = 'emptyIntervals' | 'invalidRange' | 'overlapIntervals';

/** Converts "HH:MM" to minutes; "00:00" is treated as the end of the day (24:00). */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours === 0 ? 24 : hours) * 60 + minutes;
}

export function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Half-hour options between 06:00 and 24:00 (rendered as 00:00) offered by the time pickers. */
export const TIME_OPTIONS = Array.from(
  { length: (END_MINUTES - START_MINUTES) / STEP_MINUTES + 1 },
  (_, index) => formatMinutes(START_MINUTES + index * STEP_MINUTES),
);

/** Compact label such as "9-20" or "9.30-18". */
export function formatSummaryTime(time: string): string {
  const [hours = '0', minutes = '00'] = time.split(':');
  const hourLabel = hours === '00' ? '00' : String(Number(hours));
  return minutes === '00' ? hourLabel : `${hourLabel}.${minutes}`;
}

export function sortIntervals(intervals: TWorkingInterval[]): TWorkingInterval[] {
  return [...intervals].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) {
      return startDiff;
    }
    return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });
}

/** Returns the first problem of an interval list (empty, reversed range, overlap) or null. */
export function getIntervalsErrorKey(intervals: TWorkingInterval[]): TIntervalsErrorKey | null {
  if (intervals.length === 0) {
    return 'emptyIntervals';
  }
  let previousEnd = -1;
  for (const interval of sortIntervals(intervals)) {
    const start = timeToMinutes(interval.startTime);
    const end = timeToMinutes(interval.endTime);
    if (start >= end) {
      return 'invalidRange';
    }
    if (start < previousEnd) {
      return 'overlapIntervals';
    }
    previousEnd = end;
  }
  return null;
}

/** "10:00-20:00" or "9-13, 15-20" summary for a list of intervals. */
export function formatIntervalsSummary(intervals: TWorkingInterval[]): string {
  return sortIntervals(intervals)
    .map((i) => `${formatSummaryTime(i.startTime)}-${formatSummaryTime(i.endTime)}`)
    .join(', ');
}

/** Next interval to offer when the user adds one: one hour after the last one, up to midnight. */
export function buildNextInterval(intervals: TWorkingInterval[]): TWorkingInterval {
  if (intervals.length === 0) {
    return { ...DEFAULT_WORK_INTERVAL };
  }
  const last = sortIntervals(intervals)[intervals.length - 1];
  const start = timeToMinutes(last.endTime) + 60;
  if (start < END_MINUTES) {
    return { startTime: formatMinutes(start), endTime: formatMinutes(END_MINUTES) };
  }
  return { ...DEFAULT_WORK_INTERVAL };
}
