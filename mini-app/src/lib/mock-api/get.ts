import {
  getAdminBookingsPage,
  getAdminClientsPage,
  getAllBookings,
  getAvailableSlots,
  getClientBookingsPage,
  getSchedule,
} from './queries';
import { clone } from './utils';

import type { TAdminScheduleContext, TAdminStats, TClientStats, TScheduleContext } from '../types';
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
    return clone({
      totalSessions: 18,
      totalHours: 21,
      completionRate: 86,
      sessionsThisMonth: 5,
      sessionsLastMonth: 4,
      currentStreak: 3,
      longestStreak: 7,
      mostCommonDay: 1,
      mostCommonTimeSlot: 'afternoon',
      averageDuration: 70,
      durationBreakdown: [
        { duration: 45, count: 4 },
        { duration: 60, count: 10 },
        { duration: 90, count: 4 },
      ],
      monthlyTrend: [
        { month: 'Jan', count: 3 },
        { month: 'Feb', count: 4 },
        { month: 'Mar', count: 6 },
        { month: 'Apr', count: 5 },
      ],
    } satisfies TClientStats) as T;
  }
  if (path === '/api/admin/stats') {
    return clone({
      totalBookings: 64,
      activeClients: 14,
      completionRate: 91,
      bookingsThisMonth: 22,
      bookingsLastMonth: 18,
      totalClients: state.clients.length,
      newClientsThisMonth: 3,
      topClients: state.clients.slice(0, 3).map((client, index) => ({
        name: client.displayName || client.name,
        count: 8 - index * 2,
        photoUrl: client.photoUrl,
      })),
      returningRate: 74,
      busiestDay: 3,
      busiestTimeSlot: 'afternoon',
      avgBookingsPerWeek: 9.5,
      cancellationRate: 7,
      revenueThisMonth: 84000,
      revenueLastMonth: 72000,
      revenueCurrency: 'RUB',
      revenueByMonth: [
        { month: 'Jan', revenue: 52000 },
        { month: 'Feb', revenue: 66000 },
        { month: 'Mar', revenue: 72000 },
        { month: 'Apr', revenue: 84000 },
      ],
      revenueByService: state.services.map((service, index) => ({
        name: service.name,
        revenue: [54000, 21000, 9000][index] ?? 0,
      })),
    } satisfies TAdminStats) as T;
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
  if (path === '/api/recurring' || path === '/api/admin/recurring') {
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
