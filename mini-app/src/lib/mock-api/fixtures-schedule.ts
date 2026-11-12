import { addDays } from './utils';

const WEEKDAY_SLOTS: Record<number, string[]> = {
  1: ['09:00', '10:30', '15:00', '16:30', '18:00'],
  2: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
  3: ['09:00', '10:30', '15:00', '16:30', '18:00'],
  4: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
  5: ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30'],
  6: ['10:00', '11:30', '13:00'],
};

export function getDaySlots(days: number): string[] {
  return WEEKDAY_SLOTS[addDays(days).getDay()] ?? [];
}

export function getDayOfWeek(days: number): number {
  return addDays(days).getDay();
}

export function nextWorkingOffset(from: number): number {
  let days = from;
  while (getDaySlots(days).length === 0) {
    days += 1;
  }
  return days;
}

export function slotTimeFor(dayOfWeek: number, slotIndex: number): string {
  const slots = WEEKDAY_SLOTS[dayOfWeek] ?? WEEKDAY_SLOTS[1];
  return slots[Math.min(slotIndex, slots.length - 1)];
}

export type TSlotPlanner = {
  reserve: (days: number, slotIndex: number, clientId: string) => { days: number; time: string };
  reserveExact: (days: number, time: string, clientId: string) => boolean;
  freeSlot: (days: number, clientId: string, startIndex: number) => string | null;
  count: (days: number) => number;
};

export function createSlotPlanner(blockedDays: number[]): TSlotPlanner {
  const blocked = new Set(blockedDays);
  const taken = new Set<string>();
  const clientsByDay = new Map<number, Set<string>>();

  function isFree(days: number, time: string, clientId: string): boolean {
    return !taken.has(`${days}:${time}`) && !clientsByDay.get(days)?.has(clientId);
  }

  function claim(days: number, time: string, clientId: string): void {
    taken.add(`${days}:${time}`);
    const clients = clientsByDay.get(days) ?? new Set<string>();
    clients.add(clientId);
    clientsByDay.set(days, clients);
  }

  function freeSlot(days: number, clientId: string, startIndex: number): string | null {
    const slots = getDaySlots(days);
    if (blocked.has(days)) {
      return null;
    }
    for (let i = 0; i < slots.length; i++) {
      const time = slots[(startIndex + i) % slots.length];
      if (isFree(days, time, clientId)) {
        return time;
      }
    }
    return null;
  }

  return {
    reserve(days, slotIndex, clientId) {
      const step = days < 0 ? -1 : 1;
      for (let day = days, guard = 0; guard < 60; day += step, guard++) {
        const time = freeSlot(day, clientId, slotIndex);
        if (time) {
          claim(day, time, clientId);
          return { days: day, time };
        }
      }
      throw new Error('Mock fixtures: no free slot found');
    },
    reserveExact(days, time, clientId) {
      if (blocked.has(days) || !isFree(days, time, clientId)) {
        return false;
      }
      claim(days, time, clientId);
      return true;
    },
    freeSlot,
    count(days) {
      return getDaySlots(days).filter((time) => taken.has(`${days}:${time}`)).length;
    },
  };
}
