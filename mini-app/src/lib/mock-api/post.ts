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
  TPromoValidation,
  TRecurringPreviewResponse,
  TSessionType,
} from '../types';
import type { TMockState } from './types';

const MOCK_PROMO_CODE = 'MOCK100';

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
  if (path === '/api/admin/subscription/checkout') {
    const plan = getString(body.plan, '');
    const promoCode = getOptionalString(body.promoCode);
    if (promoCode?.toUpperCase() === MOCK_PROMO_CODE) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      state.subscription = {
        ...state.subscription,
        status: 'active',
        plan,
        isPro: true,
        currentPeriodEndAt: periodEnd.toISOString(),
        autoRenew: true,
        cancelAtPeriodEnd: false,
        trialEndsAt: undefined,
      };
      return clone({ granted: true }) as T;
    }
    return clone({ confirmationUrl: 'https://mock.yookassa.ru/pay?mock=1' }) as T;
  }
  if (path === '/api/admin/promocode/validate') {
    const code = getString(body.code, '');
    const plan = getString(body.plan, '');
    const planData = state.subscription.plans.find((p) => p.code === plan);
    if (code.toUpperCase() === MOCK_PROMO_CODE && planData) {
      const discountKopecks = planData.priceKopecks;
      return clone({
        valid: true,
        discountType: 'percent',
        discountValue: 100,
        finalKopecks: 0,
        discountKopecks,
      } satisfies TPromoValidation) as T;
    }
    return clone({
      valid: false,
      reason: 'Промокод не найден или уже использован',
    } satisfies TPromoValidation) as T;
  }
  if (path === '/api/admin/subscription/cancel') {
    state.subscription = {
      ...state.subscription,
      autoRenew: false,
      cancelAtPeriodEnd: true,
    };
    return clone(state.subscription) as T;
  }
  if (path === '/api/admin/subscription/resume') {
    state.subscription = {
      ...state.subscription,
      autoRenew: true,
      cancelAtPeriodEnd: false,
    };
    return clone(state.subscription) as T;
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
