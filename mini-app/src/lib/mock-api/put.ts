import { updateBooking, updateSchedule } from './mutations';
import { bumpChangeVersions } from './state';
import { addMinutesToISO, clone, dateString, getOptionalString, getString } from './utils';

import type { TAdminNotifications, TMockState } from './types';
import type {
  TBooking,
  TClientInfo,
  TClientProfile,
  TSessionType,
  TSpecialist,
  TWorkingHours,
} from '../types';

export function handlePut<T>(
  state: TMockState,
  endpoint: string,
  path: string,
  body: Record<string, unknown>,
): T | undefined {
  if (path === '/api/profile') {
    state.clientProfile = { ...state.clientProfile, ...(body as Partial<TClientProfile>) };
    bumpChangeVersions(state, ['clientProfile']);
    return clone(state.clientProfile) as T;
  }
  if (path === '/api/profile/notifications') {
    state.clientProfile = { ...state.clientProfile, ...(body as Partial<TClientProfile>) };
    bumpChangeVersions(state, ['clientProfile']);
    return clone(state.clientProfile) as T;
  }
  if (path === '/api/admin/profile') {
    state.adminProfile = { ...state.adminProfile, ...(body as Partial<TSpecialist>) };
    bumpChangeVersions(state, ['specialist']);
    return clone(state.adminProfile) as T;
  }
  if (path === '/api/admin/working-hours') {
    const hours = Array.isArray(body.hours) ? (body.hours as TWorkingHours[]) : [];
    state.workingHours = clone(hours);
    bumpChangeVersions(state, ['workingHours']);
    return clone(state.workingHours) as T;
  }
  if (path === '/api/admin/notifications') {
    state.adminNotifications = {
      ...state.adminNotifications,
      ...(body as Partial<TAdminNotifications>),
    };
    bumpChangeVersions(state, ['adminNotifications']);
    return clone(state.adminNotifications) as T;
  }

  const clientConfirmMatch = path.match(/^\/api\/bookings\/([^/]+)\/confirm$/);
  if (clientConfirmMatch) {
    return updateBooking(state, clientConfirmMatch[1], (booking) => ({
      ...booking,
      status: 'confirmed',
    })) as T;
  }

  const clientDeclineMatch = path.match(/^\/api\/bookings\/([^/]+)\/decline$/);
  if (clientDeclineMatch) {
    return updateBooking(state, clientDeclineMatch[1], (booking) => ({
      ...booking,
      status: 'rejected',
    })) as T;
  }

  const adminBookingStatusMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)\/status$/);
  if (adminBookingStatusMatch) {
    return updateBooking(state, adminBookingStatusMatch[1], (booking) => ({
      ...booking,
      status: getString(body.status, booking.status) as TBooking['status'],
      cancelReason: getOptionalString(body.reason),
    })) as T;
  }

  const adminRescheduleMatch = path.match(/^\/api\/admin\/bookings\/([^/]+)\/reschedule$/);
  if (adminRescheduleMatch) {
    return handleAdminReschedule(state, adminRescheduleMatch[1], body) as T;
  }

  const approveRescheduleMatch = path.match(/^\/api\/bookings\/([^/]+)\/approve-reschedule$/);
  if (approveRescheduleMatch) {
    return handleApproveReschedule(state, approveRescheduleMatch[1]) as T;
  }

  const declineRescheduleMatch = path.match(/^\/api\/bookings\/([^/]+)\/decline-reschedule$/);
  if (declineRescheduleMatch) {
    state.bookings = state.bookings.filter(
      (booking) =>
        !(booking.id === declineRescheduleMatch[1] && booking.status === 'reschedule_pending'),
    );
    bumpChangeVersions(state, ['bookings']);
    return undefined as T;
  }

  const serviceMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
  if (serviceMatch) {
    let updated: TSessionType | null = null;
    state.services = state.services.map((service) => {
      if (service.id !== serviceMatch[1]) {
        return service;
      }
      updated = { ...service, ...(body as Partial<TSessionType>) };
      return updated;
    });
    if (!updated) {
      throw new Error('Mock service not found');
    }
    bumpChangeVersions(state, ['services']);
    return clone(updated) as T;
  }

  const clientMatch = path.match(/^\/api\/admin\/clients\/([^/]+)$/);
  if (clientMatch) {
    let updated: TClientInfo | null = null;
    state.clients = state.clients.map((client) => {
      if (client.id !== clientMatch[1]) {
        return client;
      }
      updated = {
        ...client,
        name: getString(body.name, client.name),
        displayName: client.isGhost
          ? undefined
          : (getOptionalString(body.name) ?? client.displayName),
      };
      return updated;
    });
    if (!updated) {
      throw new Error('Mock client not found');
    }
    bumpChangeVersions(state, ['clients', 'bookings', 'recurring']);
    return clone(updated) as T;
  }

  const adminApproveScheduleMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)\/approve$/);
  if (adminApproveScheduleMatch) {
    return updateSchedule(state, adminApproveScheduleMatch[1], (schedule) => ({
      ...schedule,
      status: 'active',
    })) as T;
  }

  const adminDeclineScheduleMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)\/decline$/);
  if (adminDeclineScheduleMatch) {
    return updateSchedule(state, adminDeclineScheduleMatch[1], (schedule) => ({
      ...schedule,
      status: 'declined',
    })) as T;
  }

  const cancelRequestMatch = path.match(
    /^\/api\/(?:admin\/)?recurring\/([^/]+)\/bookings\/([^/]+)\/cancel-request$/,
  );
  if (cancelRequestMatch) {
    return updateBooking(state, cancelRequestMatch[2], (booking) => ({
      ...booking,
      status: 'cancel_requested',
    })) as T;
  }

  const approveMoveMatch = path.match(
    /^\/api\/admin\/recurring\/([^/]+)\/bookings\/([^/]+)\/approve-move$/,
  );
  if (approveMoveMatch) {
    return updateBooking(state, approveMoveMatch[2], (booking) => ({
      ...booking,
      status: 'confirmed',
    })) as T;
  }

  const declineMoveMatch = path.match(
    /^\/api\/admin\/recurring\/([^/]+)\/bookings\/([^/]+)\/decline-move$/,
  );
  if (declineMoveMatch) {
    updateBooking(state, declineMoveMatch[2], (booking) => ({
      ...booking,
      status: 'confirmed',
    }));
    return undefined as T;
  }

  return undefined;
}

function handleAdminReschedule(
  state: TMockState,
  originalId: string,
  body: Record<string, unknown>,
): TBooking {
  const original = state.bookings.find((booking) => booking.id === originalId);
  const date = getString(body.date, dateString(1));
  const time = getString(body.time, '10:00');
  const startsAt = `${date}T${time}:00Z`;
  const duration = original?.durationMinutes ?? 60;
  const message = getOptionalString(body.message);

  if (original?.status === 'confirmed' && !original.clientIsGhost) {
    state.bookings = state.bookings.filter(
      (booking) =>
        !(booking.replacesBookingId === originalId && booking.status === 'reschedule_pending'),
    );
    const shadow: TBooking = {
      ...original,
      id: `mock-reschedule-${Date.now()}`,
      status: 'reschedule_pending',
      startsAt,
      endsAt: addMinutesToISO(startsAt, duration),
      clientMessage: message,
      createdBy: 'specialist',
      replacesBookingId: originalId,
    };
    state.bookings = [shadow, ...state.bookings];
    bumpChangeVersions(state, ['bookings']);
    return clone(shadow);
  }

  return updateBooking(state, originalId, (booking) => ({
    ...booking,
    startsAt,
    endsAt: addMinutesToISO(startsAt, booking.durationMinutes ?? 60),
  }));
}

function handleApproveReschedule(state: TMockState, shadowId: string): TBooking {
  const shadow = state.bookings.find((booking) => booking.id === shadowId);
  if (shadow?.status !== 'reschedule_pending') {
    throw new Error('Mock reschedule not found');
  }
  const originalId = shadow.replacesBookingId;
  state.bookings = state.bookings.map((booking) => {
    if (booking.id === shadowId) {
      return { ...booking, status: 'confirmed' as const };
    }
    if (originalId && booking.id === originalId) {
      return { ...booking, status: 'cancelled' as const, cancelReason: 'rescheduled' };
    }
    return booking;
  });
  bumpChangeVersions(state, ['bookings']);
  return clone(state.bookings.find((booking) => booking.id === shadowId)!);
}
