import { WorkingHours } from './types';

export function parseDayTimes(dayTimesJSON?: string): Record<string, string> | null {
  if (!dayTimesJSON) return null;
  try {
    return JSON.parse(dayTimesJSON);
  } catch {
    return null;
  }
}

export function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function generateTimeSlotsForDay(
  workingHours: WorkingHours[],
  day: number,
  durationMinutes: number,
): string[] {
  if (durationMinutes <= 0) return [];
  const wh = workingHours.find((h) => h.dayOfWeek === day);
  if (!wh) return [];
  const [startH, startM] = wh.startTime.split(':').map(Number);
  const [endH, endM] = wh.endTime.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const slots: string[] = [];
  for (let m = startMin; m + durationMinutes <= endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}
