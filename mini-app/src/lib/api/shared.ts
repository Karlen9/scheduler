import { markBotDeleted } from '../bot-deleted';
import { fetchMockAPI } from '../mock-api';
import { emitMutation } from '../mutation-events';
import { stripTelegramProfilePhotoPrefix } from '../photos';
import { dedupeRequest } from '../request-cache';
import { isPreviewRoute, isTestRoute } from '../routes';
import { getSpecialistId, waitForInitData } from '../telegram';

import type { TWorkingHours } from '../types';

export const API_BASE_URL = '';
export const DEFAULT_CLIENT_BOOKINGS_LIMIT = 50;
export const DEFAULT_ADMIN_DASHBOARD_BOOKINGS_LIMIT = 100;
export const DEFAULT_ADMIN_CLIENTS_LIMIT = 50;

const PREVIEW_READ_ONLY_ERROR = 'Preview is read-only';

export function normalizeIncomingHours(hours: TWorkingHours[]): TWorkingHours[] {
  return hours.map((wh) => ({
    ...wh,
    endTime: wh.endTime === '24:00' ? '00:00' : wh.endTime,
  }));
}

export function normalizeOutgoingHours<T extends { endTime: string }>(hours: T[]): T[] {
  return hours.map((wh) => ({
    ...wh,
    endTime: wh.endTime === '00:00' ? '24:00' : wh.endTime,
  }));
}

function getPreviewEndpoint(endpoint: string): string {
  if (!endpoint.startsWith('/api/') || endpoint.startsWith('/api/admin/')) {
    return endpoint;
  }

  return `/api/preview${endpoint.slice('/api'.length)}`;
}

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (isTestRoute()) {
    return fetchMockAPI<T>(endpoint, options);
  }

  const initData = await waitForInitData();
  const specialistId = getSpecialistId();
  const method = (options?.method ?? 'GET').toUpperCase();
  const isPreview = isPreviewRoute();

  if (isPreview && method !== 'GET') {
    throw new Error(PREVIEW_READ_ONLY_ERROR);
  }

  const isFormData = options?.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options?.headers || {}),
  };

  if (initData) {
    (headers as Record<string, string>)['X-Telegram-Init-Data'] = initData;
  }
  if (specialistId) {
    (headers as Record<string, string>)['X-Specialist-ID'] = specialistId;
  }

  const request = async (): Promise<T> => {
    const resolvedEndpoint = isPreview ? getPreviewEndpoint(endpoint) : endpoint;
    const response = await fetch(`${API_BASE_URL}${resolvedEndpoint}`, {
      ...options,
      cache: options?.cache ?? 'no-store',
      headers,
    });

    if (!response.ok) {
      if (response.status === 410) {
        markBotDeleted();
      }

      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = response.status === 204 ? (undefined as T) : await response.json();

    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      emitMutation({ method, endpoint });
    }

    return data;
  };

  if (method !== 'GET') {
    return request();
  }

  const requestKey = [
    method,
    isPreview ? getPreviewEndpoint(endpoint) : endpoint,
    specialistId ?? '',
    initData,
  ].join(':');

  return dedupeRequest(requestKey, request);
}

export function getPhotoUrl(fileIdOrUrl?: string | null): string | null {
  if (!fileIdOrUrl) {
    return null;
  }

  if (
    fileIdOrUrl.startsWith('http') ||
    fileIdOrUrl.startsWith('data:') ||
    fileIdOrUrl.startsWith('blob:')
  ) {
    return fileIdOrUrl;
  }

  const specialistId = getSpecialistId();

  const query = new URLSearchParams();
  if (specialistId) {
    query.set('specialist', specialistId);
  }
  const suffix = query.toString();

  const fileId = stripTelegramProfilePhotoPrefix(fileIdOrUrl);
  return `${API_BASE_URL}/api/photo/${encodeURIComponent(fileId)}${suffix ? `?${suffix}` : ''}`;
}
