import { DEFAULT_CLIENT_BOOKINGS_LIMIT, fetchAPI, normalizeIncomingHours } from './shared';

import type {
  TBooking,
  TBookingListResponse,
  TChangeVersions,
  TClientBatch,
  TClientProfile,
  TClientStats,
  TRecurringPreviewResponse,
  TRecurringSchedule,
  TScheduleContext,
  TSessionType,
  TSpecialist,
  TTimeSlot,
  TWorkingHours,
} from '../types';

async function getBookingsPage(params: {
  page: number;
  limit: number;
}): Promise<TBookingListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  return fetchAPI<TBookingListResponse>(`/api/bookings?${query.toString()}`);
}

export const clientApi = {
  async getSpecialist(): Promise<TSpecialist> {
    return fetchAPI<TSpecialist>('/api/specialist');
  },

  async getSessionTypes(): Promise<TSessionType[]> {
    return fetchAPI<TSessionType[]>('/api/services');
  },

  async getWorkingHours(): Promise<TWorkingHours[]> {
    const hours = await fetchAPI<TWorkingHours[]>('/api/working-hours');
    return normalizeIncomingHours(hours);
  },

  async getScheduleContext(): Promise<TScheduleContext> {
    const ctx = await fetchAPI<TScheduleContext>('/api/schedule-context');
    return { ...ctx, workingHours: normalizeIncomingHours(ctx.workingHours ?? []) };
  },

  async getDaysOff(): Promise<{ date: string }[]> {
    return fetchAPI<{ date: string }[]>('/api/days-off');
  },

  async getAvailableSlots(date: string, duration: number): Promise<TTimeSlot[]> {
    return fetchAPI<TTimeSlot[]>(`/api/availability?date=${date}&duration=${duration}`);
  },

  async getBookings(): Promise<TBooking[]> {
    const response = await getBookingsPage({ page: 1, limit: DEFAULT_CLIENT_BOOKINGS_LIMIT });
    return response.bookings;
  },

  getBookingsPage,

  async getClientBatches(): Promise<TClientBatch[]> {
    return fetchAPI<TClientBatch[]>('/api/batches');
  },

  async getClientStats(): Promise<TClientStats> {
    return fetchAPI<TClientStats>('/api/stats');
  },

  async getChangeVersions(): Promise<TChangeVersions> {
    return fetchAPI<TChangeVersions>('/api/changes');
  },

  async createBooking(
    duration: number,
    date: string,
    time: string,
    name: string,
    message?: string,
    sessionTypeId?: string,
  ): Promise<TBooking> {
    return fetchAPI<TBooking>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ duration, date, time, name, message, sessionTypeId }),
    });
  },

  async cancelBooking(bookingId: string, reason?: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  async rescheduleBooking(
    bookingId: string,
    data: { date: string; time: string },
  ): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async confirmBooking(bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}/confirm`, {
      method: 'PUT',
    });
  },

  async declineBooking(bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}/decline`, {
      method: 'PUT',
    });
  },

  async approveReschedule(bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}/approve-reschedule`, {
      method: 'PUT',
    });
  },

  async declineReschedule(bookingId: string): Promise<void> {
    await fetchAPI<void>(`/api/bookings/${bookingId}/decline-reschedule`, {
      method: 'PUT',
    });
  },

  async uploadPhoto(file: File): Promise<{ fileId: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return fetchAPI<{ fileId: string }>('/api/upload/photo', {
      method: 'POST',
      body: formData,
    });
  },

  async restoreTelegramPhoto(): Promise<TClientProfile> {
    return fetchAPI<TClientProfile>('/api/profile/restore-telegram-photo', {
      method: 'POST',
    });
  },

  async getProfile(): Promise<TClientProfile> {
    return fetchAPI<TClientProfile>('/api/profile');
  },

  async updateProfile(data: {
    name?: string;
    phone?: string;
    photoUrl?: string;
    preferredDuration?: number;
    language?: string;
  }): Promise<TClientProfile> {
    return fetchAPI<TClientProfile>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async updateNotificationPrefs(prefs: {
    notifyBookingStatus?: boolean;
    notifyReminders?: boolean;
    notifyDaysOff?: boolean;
    notifyCancellations?: boolean;
  }): Promise<TClientProfile> {
    return fetchAPI<TClientProfile>('/api/profile/notifications', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },

  async getRecurringSchedules(): Promise<TRecurringSchedule[]> {
    return fetchAPI<TRecurringSchedule[]>('/api/recurring');
  },

  async getRecurringScheduleDetail(id: string): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>(`/api/recurring/${id}`);
  },

  async createRecurringSchedule(data: {
    sessionTypeId: string;
    dayTimes: Record<string, string>;
    period: string;
  }): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async previewRecurringSchedule(data: {
    sessionTypeId: string;
    dayTimes: Record<string, string>;
    period: string;
  }): Promise<TRecurringPreviewResponse> {
    return fetchAPI<TRecurringPreviewResponse>('/api/recurring/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelRecurringSchedule(id: string): Promise<void> {
    await fetchAPI<void>(`/api/recurring/${id}`, { method: 'DELETE' });
  },

  async requestCancelBooking(scheduleId: string, bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/recurring/${scheduleId}/bookings/${bookingId}/cancel-request`, {
      method: 'PUT',
    });
  },

  async requestMoveBooking(
    scheduleId: string,
    bookingId: string,
    data: { date: string; time: string },
  ): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/recurring/${scheduleId}/bookings/${bookingId}/move`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
