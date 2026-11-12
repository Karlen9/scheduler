import { ApiError, WorkDatesConflictError, toRoomError } from '../api-error';
import {
  DEFAULT_ADMIN_CLIENTS_LIMIT,
  DEFAULT_ADMIN_DASHBOARD_BOOKINGS_LIMIT,
  fetchAPI,
  normalizeIncomingHours,
  normalizeOutgoingHours,
} from './shared';

import type {
  TAdminBookingsQuery,
  TAdminBookingsResponse,
  TAdminScheduleContext,
  TAdminStats,
  TAdminWorkDate,
  TBooking,
  TClientBatch,
  TClientInfo,
  TClientListQuery,
  TClientListResponse,
  TDayOff,
  TRecurringPreviewResponse,
  TRecurringSchedule,
  TReferralsResponse,
  TRoomDayAssign,
  TRoomMember,
  TRoomResponse,
  TScheduleMode,
  TScheduleSettings,
  TSessionType,
  TSpecialist,
  TWorkDatesUpdate,
  TWorkingHours,
  TWorkingInterval,
} from '../types';

async function getBookingsPage(params: TAdminBookingsQuery): Promise<TAdminBookingsResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  for (const status of params.statuses ?? []) {
    query.append('status', status);
  }
  if (params.dateFrom) {
    query.set('dateFrom', params.dateFrom);
  }
  if (params.dateTo) {
    query.set('dateTo', params.dateTo);
  }
  if (params.clientId) {
    query.set('clientId', params.clientId);
  }
  for (const serviceId of params.serviceIds ?? []) {
    query.append('serviceId', serviceId);
  }
  if (params.sort) {
    query.set('sort', params.sort);
  }
  return fetchAPI<TAdminBookingsResponse>(`/api/admin/bookings?${query.toString()}`);
}

async function getClientsPage(params: TClientListQuery): Promise<TClientListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }
  return fetchAPI<TClientListResponse>(`/api/admin/clients?${query.toString()}`);
}

function normalizeWorkDates(workDates: TAdminWorkDate[]): TAdminWorkDate[] {
  return workDates.map((wd) => ({
    ...wd,
    intervals: normalizeIncomingHours(wd.intervals ?? []),
  }));
}

function parseWorkDatesConflict(err: ApiError): WorkDatesConflictError {
  try {
    const body = JSON.parse(err.message) as { message?: string; dates?: string[] };
    return new WorkDatesConflictError(body.message ?? err.message, body.dates ?? []);
  } catch {
    return new WorkDatesConflictError(err.message, []);
  }
}

/** Room endpoints answer 403/409 with `{error, message, dates}`: surface that as a RoomError. */
async function roomRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    return await fetchAPI<T>(endpoint, options);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
      throw toRoomError(err);
    }
    throw err;
  }
}

function jsonBody(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

export const adminApi = {
  async getProfile(): Promise<TSpecialist> {
    return fetchAPI<TSpecialist>('/api/admin/profile');
  },

  async updateProfile(data: Partial<TSpecialist>): Promise<TSpecialist> {
    return fetchAPI<TSpecialist>('/api/admin/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getServices(): Promise<TSessionType[]> {
    return fetchAPI<TSessionType[]>('/api/admin/services');
  },

  async createService(data: {
    type: string;
    name: string;
    durationMinutes: number;
    price: number;
    currency?: string;
    imageUrl?: string;
    sessionsCount?: number;
  }): Promise<TSessionType> {
    return fetchAPI<TSessionType>('/api/admin/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateService(id: string, data: Partial<TSessionType>): Promise<TSessionType> {
    return fetchAPI<TSessionType>(`/api/admin/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteService(id: string): Promise<void> {
    await fetchAPI<void>(`/api/admin/services/${id}`, {
      method: 'DELETE',
    });
  },

  async getClientBatches(clientId: string): Promise<TClientBatch[]> {
    return fetchAPI<TClientBatch[]>(`/api/admin/clients/${clientId}/batches`);
  },

  async assignClientBatch(clientId: string, serviceId: string): Promise<TClientBatch> {
    return fetchAPI<TClientBatch>(`/api/admin/clients/${clientId}/batches`, {
      method: 'POST',
      body: JSON.stringify({ service_id: serviceId }),
    });
  },

  async getWorkingHours(): Promise<TWorkingHours[]> {
    const hours = await fetchAPI<TWorkingHours[]>('/api/admin/working-hours');
    return normalizeIncomingHours(hours);
  },

  async getScheduleContext(): Promise<TAdminScheduleContext> {
    const ctx = await fetchAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    return {
      ...ctx,
      workingHours: normalizeIncomingHours(ctx.workingHours ?? []),
      ...(ctx.defaultIntervals
        ? { defaultIntervals: normalizeIncomingHours(ctx.defaultIntervals) }
        : {}),
      ...(ctx.workDates ? { workDates: normalizeWorkDates(ctx.workDates) } : {}),
    };
  },

  /** Switches the schedule mode and saves the default hours used by dates mode. */
  async updateScheduleSettings(body: {
    scheduleMode: TScheduleMode;
    defaultIntervals: TWorkingInterval[];
  }): Promise<TScheduleSettings> {
    const result = await fetchAPI<TScheduleSettings>('/api/admin/schedule-settings', {
      method: 'PUT',
      body: JSON.stringify({
        scheduleMode: body.scheduleMode,
        defaultIntervals: normalizeOutgoingHours(body.defaultIntervals),
      }),
    });
    return {
      ...result,
      defaultIntervals: normalizeIncomingHours(result.defaultIntervals ?? []),
      autoOpened: result.autoOpened ?? 0,
    };
  },

  /**
   * Opens and closes dates in one request. A 409 (closing dates that have bookings) is rethrown
   * as WorkDatesConflictError carrying the conflicting dates.
   */
  async updateWorkDates(body: TWorkDatesUpdate): Promise<TAdminWorkDate[]> {
    try {
      const result = await fetchAPI<TAdminWorkDate[]>('/api/admin/work-dates', {
        method: 'PUT',
        body: JSON.stringify({
          open: body.open.map((entry) => ({
            date: entry.date,
            intervals: entry.intervals ? normalizeOutgoingHours(entry.intervals) : null,
          })),
          close: body.close,
        }),
      });
      return normalizeWorkDates(result ?? []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw parseWorkDatesConflict(err);
      }
      throw err;
    }
  },

  async updateWorkingHours(hours: TWorkingHours[]): Promise<TWorkingHours[]> {
    const result = await fetchAPI<TWorkingHours[]>('/api/admin/working-hours', {
      method: 'PUT',
      body: JSON.stringify({ hours: normalizeOutgoingHours(hours) }),
    });
    return normalizeIncomingHours(result);
  },

  async getDaysOff(): Promise<TDayOff[]> {
    return fetchAPI<TDayOff[]>('/api/admin/days-off');
  },

  async createDayOffsBatch(dates: string[], reason?: string): Promise<TDayOff[]> {
    return fetchAPI<TDayOff[]>('/api/admin/days-off/batch', {
      method: 'POST',
      body: JSON.stringify({ dates, reason }),
    });
  },

  async deleteDayOff(id: string): Promise<void> {
    await fetchAPI<void>(`/api/admin/days-off/${id}`, {
      method: 'DELETE',
    });
  },

  async getBookings(status?: TBooking['status']): Promise<TBooking[]> {
    const response = await getBookingsPage({
      page: 1,
      limit: DEFAULT_ADMIN_DASHBOARD_BOOKINGS_LIMIT,
      statuses: status ? [status] : ['pending', 'confirmed'],
      sort: 'starts_at_asc',
    });
    return response.bookings;
  },

  getBookingsPage,

  async getAdminStats(): Promise<TAdminStats> {
    return fetchAPI<TAdminStats>('/api/admin/stats');
  },

  async updateBookingStatus(bookingId: string, status: string, reason?: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/admin/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  },

  async cancelBooking(bookingId: string, reason?: string): Promise<TBooking> {
    return this.updateBookingStatus(bookingId, 'cancelled', reason);
  },

  async rescheduleBooking(
    bookingId: string,
    data: { date: string; time: string; message?: string },
  ): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/admin/bookings/${bookingId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async approveReschedule(bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/admin/bookings/${bookingId}/approve-reschedule`, {
      method: 'PUT',
    });
  },

  async declineReschedule(bookingId: string): Promise<void> {
    await fetchAPI<void>(`/api/admin/bookings/${bookingId}/decline-reschedule`, {
      method: 'PUT',
    });
  },

  async getClients(): Promise<TClientInfo[]> {
    const response = await getClientsPage({
      page: 1,
      limit: DEFAULT_ADMIN_CLIENTS_LIMIT,
    });
    return response.clients;
  },

  getClientsPage,

  async createGhostClient(name: string): Promise<TClientInfo> {
    return fetchAPI<TClientInfo>('/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async updateClient(id: string, name: string): Promise<TClientInfo> {
    return fetchAPI<TClientInfo>(`/api/admin/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  async deleteClient(id: string): Promise<void> {
    await fetchAPI<void>(`/api/admin/clients/${id}?cascade=1`, { method: 'DELETE' });
  },

  async blockClient(id: string, cancelBookings: boolean): Promise<TClientInfo> {
    return fetchAPI<TClientInfo>(`/api/admin/clients/${id}/block`, {
      method: 'PUT',
      body: JSON.stringify({ blocked: true, cancelBookings }),
    });
  },

  async unblockClient(id: string): Promise<TClientInfo> {
    return fetchAPI<TClientInfo>(`/api/admin/clients/${id}/block`, {
      method: 'PUT',
      body: JSON.stringify({ blocked: false }),
    });
  },

  async createBooking(data: {
    clientId: string;
    sessionTypeId?: string;
    duration: number;
    date: string;
    time: string;
    message?: string;
  }): Promise<TBooking> {
    return fetchAPI<TBooking>('/api/admin/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRecurringSchedules(): Promise<TRecurringSchedule[]> {
    return fetchAPI<TRecurringSchedule[]>('/api/admin/recurring');
  },

  async getRecurringScheduleDetail(id: string): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>(`/api/admin/recurring/${id}`);
  },

  async createRecurringSchedule(data: {
    clientId: string;
    sessionTypeId: string;
    dayTimes: Record<string, string>;
    period: string;
  }): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>('/api/admin/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async previewRecurringSchedule(data: {
    clientId?: string;
    sessionTypeId: string;
    dayTimes: Record<string, string>;
    period: string;
  }): Promise<TRecurringPreviewResponse> {
    return fetchAPI<TRecurringPreviewResponse>('/api/admin/recurring/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveRecurringSchedule(id: string): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>(`/api/admin/recurring/${id}/approve`, {
      method: 'PUT',
    });
  },

  async declineRecurringSchedule(id: string): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>(`/api/admin/recurring/${id}/decline`, {
      method: 'PUT',
    });
  },

  async cancelRecurringSchedule(id: string): Promise<void> {
    await fetchAPI<void>(`/api/admin/recurring/${id}`, { method: 'DELETE' });
  },

  async requestCancelBooking(scheduleId: string, bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(
      `/api/admin/recurring/${scheduleId}/bookings/${bookingId}/cancel-request`,
      {
        method: 'PUT',
      },
    );
  },

  async requestMoveBooking(
    scheduleId: string,
    bookingId: string,
    data: { date: string; time: string },
  ): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/admin/recurring/${scheduleId}/bookings/${bookingId}/move`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveMoveBooking(scheduleId: string, bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(
      `/api/admin/recurring/${scheduleId}/bookings/${bookingId}/approve-move`,
      {
        method: 'PUT',
      },
    );
  },

  async declineMoveBooking(scheduleId: string, bookingId: string): Promise<void> {
    await fetchAPI<void>(`/api/admin/recurring/${scheduleId}/bookings/${bookingId}/decline-move`, {
      method: 'PUT',
    });
  },

  async getNotificationPrefs(): Promise<{
    notifyNewBookings: boolean;
    notifyCancellations: boolean;
    notifyWorkDaysReminder?: boolean;
  }> {
    return fetchAPI('/api/admin/notifications');
  },

  async updateNotificationPrefs(prefs: {
    notifyNewBookings?: boolean;
    notifyCancellations?: boolean;
    notifyWorkDaysReminder?: boolean;
  }): Promise<{
    notifyNewBookings: boolean;
    notifyCancellations: boolean;
    notifyWorkDaysReminder?: boolean;
  }> {
    return fetchAPI('/api/admin/notifications', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  async getRoom(): Promise<TRoomResponse> {
    return fetchAPI<TRoomResponse>('/api/admin/room');
  },

  async createRoom(name: string): Promise<TRoomResponse> {
    return roomRequest<TRoomResponse>('/api/admin/room', jsonBody('POST', { name }));
  },

  async updateRoom(name: string): Promise<TRoomResponse> {
    return roomRequest<TRoomResponse>('/api/admin/room', jsonBody('PUT', { name }));
  },

  async addRoomMember(body: {
    name: string;
    color: string;
    invite: boolean;
  }): Promise<{ member: TRoomMember; inviteLink?: string }> {
    return roomRequest('/api/admin/room/members', jsonBody('POST', body));
  },

  async updateRoomMember(
    id: string,
    body: { name?: string; color?: string },
  ): Promise<TRoomMember | undefined> {
    return roomRequest(`/api/admin/room/members/${encodeURIComponent(id)}`, jsonBody('PUT', body));
  },

  /** Removes a member; with the caller's own member id this leaves the room. */
  async deleteRoomMember(id: string): Promise<void> {
    await roomRequest<void>(`/api/admin/room/members/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async createRoomMemberInvite(id: string): Promise<{ inviteLink: string }> {
    return roomRequest(
      `/api/admin/room/members/${encodeURIComponent(id)}/invite`,
      jsonBody('POST'),
    );
  },

  /** Assigns room days (memberId "" frees a day). Returns the fresh room payload. */
  async updateRoomDays(assign: TRoomDayAssign[]): Promise<TRoomResponse> {
    return roomRequest<TRoomResponse>('/api/admin/room/days', jsonBody('PUT', { assign }));
  },

  async createRoomRequest(date: string): Promise<void> {
    await roomRequest<unknown>('/api/admin/room/requests', jsonBody('POST', { date }));
  },

  async acceptRoomRequest(id: string): Promise<void> {
    await roomRequest<unknown>(
      `/api/admin/room/requests/${encodeURIComponent(id)}/accept`,
      jsonBody('POST'),
    );
  },

  async declineRoomRequest(id: string): Promise<void> {
    await roomRequest<unknown>(
      `/api/admin/room/requests/${encodeURIComponent(id)}/decline`,
      jsonBody('POST'),
    );
  },

  async cancelRoomRequest(id: string): Promise<void> {
    await roomRequest<void>(`/api/admin/room/requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async getReferrals(): Promise<TReferralsResponse> {
    return fetchAPI<TReferralsResponse>('/api/admin/referrals');
  },

  async deleteBot(confirm: string): Promise<void> {
    await fetchAPI<void>('/api/admin/specialist', {
      method: 'DELETE',
      body: JSON.stringify({ confirm }),
    });
  },
};
