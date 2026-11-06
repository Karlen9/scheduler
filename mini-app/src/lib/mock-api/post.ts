import { createBookingFromBody, createRecurringSchedule, updateBooking } from './mutations';
import { buildPreviewDates } from './queries';
import { bumpChangeVersions } from './state';
import { mockPhotoDataUrl } from './types';
import { clone, getNumber, getOptionalString, getString } from './utils';

import type {
  TBooking,
  TClientBatch,
  TClientInfo,
  TDayOff,
  TRecurringPreviewResponse,
  TSessionType,
} from '../types';
import type { TMockState } from './types';

export function handlePost<T>(
  state: TMockState,
  endpoint: string,
  path: string,
  body: Record<string, unknown>,
): T | undefined {
  if (path === '/api/bookings') {
    return createBookingFromBody(state, body, 'client') as T;
  }
  if (path === '/api/admin/bookings') {
    return createBookingFromBody(state, body, 'specialist') as T;
  }
  if (path === '/api/recurring/preview' || path === '/api/admin/recurring/preview') {
    const dates = buildPreviewDates(
      body.dayTimes && typeof body.dayTimes === 'object'
        ? (body.dayTimes as Record<string, string>)
        : {},
    );
    return clone({ dates, count: dates.length } satisfies TRecurringPreviewResponse) as T;
  }
  if (path === '/api/recurring') {
    return createRecurringSchedule(state, body, 'client') as T;
  }
  if (path === '/api/admin/recurring') {
    return createRecurringSchedule(state, body, 'specialist') as T;
  }
  if (path === '/api/admin/services') {
    const service: TSessionType = {
      id: `mock-service-${Date.now()}`,
      type: getString(body.type, 'common'),
      name: getString(body.name, 'New service'),
      durationMinutes: getNumber(body.durationMinutes, 60),
      price: getNumber(body.price, 0),
      currency: getString(body.currency, 'RUB'),
      imageUrl: getOptionalString(body.imageUrl),
      sessionsCount: getNumber(body.sessionsCount, 0) || undefined,
    };
    state.services = [service, ...state.services];
    bumpChangeVersions(state, ['services']);
    return clone(service) as T;
  }

  const adminClientBatchesMatch = path.match(/^\/api\/admin\/clients\/([^/]+)\/batches$/);
  if (adminClientBatchesMatch) {
    const serviceId = getString(body.service_id, getString(body.serviceId));
    const service = state.services.find((item) => item.id === serviceId);
    if (service?.type !== 'batch' || !service.sessionsCount) {
      throw new Error('Invalid batch service');
    }
    const batch: TClientBatch = {
      id: `mock-client-batch-${Date.now()}`,
      clientId: adminClientBatchesMatch[1],
      serviceId,
      totalSessions: service.sessionsCount,
      remainingSessions: service.sessionsCount,
      createdAt: new Date().toISOString(),
      status: 'active',
      service,
    };
    state.clientBatches = [...state.clientBatches, batch];
    bumpChangeVersions(state, ['clientBatches', 'clients']);
    return clone(batch) as T;
  }

  if (path === '/api/admin/days-off/batch') {
    const rawDates = Array.isArray(body.dates) ? (body.dates as unknown[]) : [];
    const reason = getOptionalString(body.reason);
    const existing = new Set(state.daysOff.map((dayOff) => dayOff.date.slice(0, 10)));
    const created: TDayOff[] = [];
    const seen = new Set<string>();
    for (const raw of rawDates) {
      if (typeof raw !== 'string' || seen.has(raw) || existing.has(raw)) {
        continue;
      }
      seen.add(raw);
      created.push({
        id: `mock-day-off-${Date.now()}-${created.length}`,
        date: raw,
        reason,
        createdAt: new Date().toISOString(),
      });
    }
    if (created.length > 0) {
      state.daysOff = [...created, ...state.daysOff];
      bumpChangeVersions(state, ['daysOff']);
    }
    return clone(created) as T;
  }
  if (path === '/api/admin/clients') {
    const client: TClientInfo = {
      id: `mock-client-${Date.now()}`,
      telegramUserId: 0,
      specialistId: state.adminProfile.id,
      name: getString(body.name, 'Guest client'),
      isGhost: true,
      createdAt: new Date().toISOString(),
    };
    state.clients = [client, ...state.clients];
    bumpChangeVersions(state, ['clients']);
    return clone(client) as T;
  }
  if (path === '/api/admin/upload/photo') {
    return clone({ fileId: mockPhotoDataUrl }) as T;
  }

  const moveMatch = path.match(/^\/api\/recurring\/([^/]+)\/bookings\/([^/]+)\/move$/);
  if (moveMatch) {
    return updateMoveRequest(state, moveMatch[2]) as T;
  }

  const adminMoveMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)\/bookings\/([^/]+)\/move$/);
  if (adminMoveMatch) {
    return updateMoveRequest(state, adminMoveMatch[2]) as T;
  }

  return undefined;
}

function updateMoveRequest(state: TMockState, bookingId: string): TBooking {
  return updateBooking(state, bookingId, (booking) => ({
    ...booking,
    status: 'reschedule_pending',
  }));
}
