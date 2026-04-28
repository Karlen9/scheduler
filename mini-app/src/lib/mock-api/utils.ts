import { changeGroups } from './types';

import type { TBooking, TChangeVersions, TClientInfo, TSessionType } from '../types';

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseRequestBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') {
    return {};
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function getNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

export function getRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((result, [key, val]) => {
    if (typeof val === 'string') {
      result[key] = val;
    }
    return result;
  }, {});
}

export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function addDays(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

export function dateString(days: number): string {
  return formatDateISO(addDays(days));
}

export function isoAt(days: number, time: string): string {
  return `${dateString(days)}T${time}:00Z`;
}

export function addMinutesToISO(iso: string, minutes: number): string {
  const date = new Date(iso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export function isPastTodayTime(date: string, time: string): boolean {
  const now = new Date();
  if (date !== formatDateISO(now)) {
    return false;
  }

  const slotMinutes = timeToMinutes(time);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotMinutes <= nowMinutes;
}

export function buildBooking({
  client,
  createdBy,
  days,
  id,
  message,
  recurringScheduleId,
  service,
  status,
  time,
}: {
  client: TClientInfo;
  createdBy: 'client' | 'specialist';
  days: number;
  id: string;
  message?: string;
  recurringScheduleId?: string;
  service: TSessionType;
  status: TBooking['status'];
  time: string;
}): TBooking {
  const startsAt = isoAt(days, time);

  return {
    id,
    clientId: client.id,
    sessionType: service,
    startsAt,
    endsAt: addMinutesToISO(startsAt, service.durationMinutes),
    clientName: client.name,
    clientDisplayName: client.displayName,
    clientPhotoUrl: client.photoUrl,
    clientIsGhost: client.isGhost,
    clientTelegramUserId: client.telegramUserId,
    clientTelegramUsername: client.telegramUsername,
    clientMessage: message,
    status,
    durationMinutes: service.durationMinutes,
    createdBy,
    createdAt: isoAt(days - 2, '09:00'),
    recurringScheduleId,
  };
}

export function createInitialChangeVersions(): TChangeVersions {
  return changeGroups.reduce<TChangeVersions>((versions, group) => {
    versions[group] = 1;
    return versions;
  }, {} as TChangeVersions);
}
