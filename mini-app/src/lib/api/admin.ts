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
  TBooking,
  TClientBatch,
  TClientInfo,
  TClientListQuery,
  TClientListResponse,
  TDayOff,
  TPromoValidation,
  TRecurringPreviewResponse,
  TRecurringSchedule,
  TReferralsResponse,
  TSessionType,
  TSpecialist,
  TSubscription,
  TWorkingHours,
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

  async uploadPhoto(file: File): Promise<{ fileId: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return fetchAPI<{ fileId: string }>('/api/admin/upload/photo', {
      method: 'POST',
      body: formData,
    });
  },

  async restoreTelegramPhoto(): Promise<TSpecialist> {
    return fetchAPI<TSpecialist>('/api/admin/profile/restore-telegram-photo', {
      method: 'POST',
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
    return { ...ctx, workingHours: normalizeIncomingHours(ctx.workingHours ?? []) };
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
  }> {
    return fetchAPI('/api/admin/notifications');
  },

  async updateNotificationPrefs(prefs: {
    notifyNewBookings?: boolean;
    notifyCancellations?: boolean;
  }): Promise<{ notifyNewBookings: boolean; notifyCancellations: boolean }> {
    return fetchAPI('/api/admin/notifications', {
      method: 'PUT',
      body: JSON.stringify(prefs),
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

  async getSubscription(): Promise<TSubscription> {
    return fetchAPI<TSubscription>('/api/admin/subscription');
  },

  async checkoutSubscription(
    plan: string,
    promoCode?: string,
    autoRenew?: boolean,
  ): Promise<{ confirmationUrl?: string; granted?: boolean }> {
    return fetchAPI<{ confirmationUrl?: string; granted?: boolean }>(
      '/api/admin/subscription/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ plan, promoCode, autoRenew }),
      },
    );
  },

  async validatePromo(code: string, plan: string): Promise<TPromoValidation> {
    return fetchAPI<TPromoValidation>('/api/admin/promocode/validate', {
      method: 'POST',
      body: JSON.stringify({ code, plan }),
    });
  },

  async cancelSubscription(): Promise<TSubscription> {
    return fetchAPI<TSubscription>('/api/admin/subscription/cancel', {
      method: 'POST',
    });
  },

  async resumeSubscription(): Promise<TSubscription> {
    return fetchAPI<TSubscription>('/api/admin/subscription/resume', {
      method: 'POST',
    });
  },
};
