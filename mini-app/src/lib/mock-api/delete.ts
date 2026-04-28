import { updateBooking, updateSchedule } from './mutations';
import { bumpChangeVersions } from './state';
import { getOptionalString } from './utils';

import type { TMockState } from './types';

export function handleDelete<T>(
  state: TMockState,
  endpoint: string,
  path: string,
  body: Record<string, unknown>,
): T | undefined {
  const clientBookingMatch = path.match(/^\/api\/bookings\/([^/]+)$/);
  if (clientBookingMatch) {
    return updateBooking(state, clientBookingMatch[1], (booking) => ({
      ...booking,
      status: 'cancelled',
      cancelReason: getOptionalString(body.reason),
      cancelledBy: 'client',
    })) as T;
  }

  const serviceMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
  if (serviceMatch) {
    state.services = state.services.filter((service) => service.id !== serviceMatch[1]);
    bumpChangeVersions(state, ['services']);
    return undefined as T;
  }

  const dayOffMatch = path.match(/^\/api\/admin\/days-off\/([^/]+)$/);
  if (dayOffMatch) {
    state.daysOff = state.daysOff.filter((dayOff) => dayOff.id !== dayOffMatch[1]);
    bumpChangeVersions(state, ['daysOff']);
    return undefined as T;
  }

  const clientMatch = path.match(/^\/api\/admin\/clients\/([^/]+)$/);
  if (clientMatch) {
    const clientId = clientMatch[1];
    const cascadeParam = new URLSearchParams(endpoint.split('?')[1] ?? '').get('cascade');
    if (cascadeParam === '1') {
      const removed = state.clients.find((client) => client.id === clientId);
      const clientName = removed?.name;
      state.bookings = state.bookings.filter((booking) => booking.clientId !== clientId);
      if (clientName) {
        state.recurringSchedules = state.recurringSchedules.filter(
          (schedule) => schedule.clientName !== clientName,
        );
      }
    }
    state.clients = state.clients.filter((client) => client.id !== clientId);
    bumpChangeVersions(state, ['clients', 'bookings', 'recurring']);
    return undefined as T;
  }

  const recurringMatch = path.match(/^\/api\/(?:admin\/)?recurring\/([^/]+)$/);
  if (recurringMatch) {
    updateSchedule(state, recurringMatch[1], (schedule) => ({
      ...schedule,
      status: 'cancelled',
    }));
    return undefined as T;
  }

  return undefined;
}
