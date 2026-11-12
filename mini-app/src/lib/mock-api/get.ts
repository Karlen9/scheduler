import { buildAdminStats, buildClientStats, buildReferrals } from './fixtures-stats';
import {
  getAdminBookingsPage,
  getAdminClientsPage,
  getAllBookings,
  getAvailableSlots,
  getClientBookingsPage,
  getSchedule,
} from './queries';
import { clone } from './utils';

import type { TAdminScheduleContext, TScheduleContext } from '../types';
import type { TMockState } from './types';

export function handleGet<T>(state: TMockState, endpoint: string, path: string): T | undefined {
  if (path === '/api/specialist') {
    return clone(state.clientSpecialist) as T;
  }
  if (path === '/api/services' || path === '/api/admin/services') {
    return clone(state.services) as T;
  }
  if (path === '/api/working-hours' || path === '/api/admin/working-hours') {
    return clone(state.workingHours) as T;
  }
  if (path === '/api/schedule-context') {
    return clone({
      workingHours: state.workingHours,
      daysOff: state.daysOff.map((dayOff) => ({ date: dayOff.date })),
    } satisfies TScheduleContext) as T;
  }
  if (path === '/api/admin/schedule-context') {
    return clone({
      workingHours: state.workingHours,
      daysOff: state.daysOff,
    } satisfies TAdminScheduleContext) as T;
  }
  if (path === '/api/days-off') {
    return clone(state.daysOff.map((dayOff) => ({ date: dayOff.date }))) as T;
  }
  if (path === '/api/admin/days-off') {
    return clone(state.daysOff) as T;
  }
  if (path === '/api/availability') {
    return clone(getAvailableSlots(state, endpoint)) as T;
  }
  if (path === '/api/bookings') {
    const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
    if (params.has('page') || params.has('limit')) {
      return getClientBookingsPage(state, endpoint) as T;
    }
    return clone(
      getAllBookings(state).filter((booking) => booking.clientName === state.clientProfile.name),
    ) as T;
  }
  if (path === '/api/batches') {
    return clone(
      state.clientBatches.filter((batch) => batch.clientId === state.clientProfile.id),
    ) as T;
  }
  if (path === '/api/admin/bookings') {
    const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
    if (params.has('page') || params.has('limit')) {
      return getAdminBookingsPage(state, endpoint) as T;
    }
    const status = params.get('status');
    const bookings = getAllBookings(state);
    return clone(status ? bookings.filter((booking) => booking.status === status) : bookings) as T;
  }
  if (path === '/api/stats') {
    return clone(buildClientStats()) as T;
  }
  if (path === '/api/admin/stats') {
    return clone(buildAdminStats(state)) as T;
  }
  if (path === '/api/admin/referrals') {
    return clone(buildReferrals(state)) as T;
  }

  const adminClientBatchesMatch = path.match(/^\/api\/admin\/clients\/([^/]+)\/batches$/);
  if (adminClientBatchesMatch) {
    return clone(
      state.clientBatches.filter((batch) => batch.clientId === adminClientBatchesMatch[1]),
    ) as T;
  }
  if (path === '/api/changes') {
    return clone(state.changeVersions) as T;
  }
  if (path === '/api/profile') {
    return clone(state.clientProfile) as T;
  }
  if (path === '/api/recurring') {
    return clone(
      state.recurringSchedules.filter(
        (schedule) => schedule.clientName === state.clientProfile.name,
      ),
    ) as T;
  }
  if (path === '/api/admin/recurring') {
    return clone(state.recurringSchedules) as T;
  }
  if (path === '/api/admin/profile') {
    return clone(state.adminProfile) as T;
  }
  if (path === '/api/admin/clients') {
    const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
    if (params.has('page') || params.has('limit') || params.has('search')) {
      return getAdminClientsPage(state, endpoint) as T;
    }
    return clone(state.clients) as T;
  }
  if (path === '/api/admin/notifications') {
    return clone(state.adminNotifications) as T;
  }

  const clientRecurringDetailMatch = path.match(/^\/api\/recurring\/([^/]+)$/);
  if (clientRecurringDetailMatch) {
    return clone(getSchedule(state, clientRecurringDetailMatch[1])) as T;
  }

  const adminRecurringDetailMatch = path.match(/^\/api\/admin\/recurring\/([^/]+)$/);
  if (adminRecurringDetailMatch) {
    return clone(getSchedule(state, adminRecurringDetailMatch[1])) as T;
  }
  return undefined;
}
