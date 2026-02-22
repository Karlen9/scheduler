import { getInitData, getSpecialistId } from './telegram';

import type {
  TBooking,
  TClientInfo,
  TClientProfile,
  TDayOff,
  TRecurringPreviewResponse,
  TRecurringSchedule,
  TSessionType,
  TSpecialist,
  TTimeSlot,
  TWorkingHours,
} from './types';

// API calls use relative URLs — Next.js rewrites proxy them to the backend
const API_BASE_URL = '';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const initData = getInitData();
  const specialistId = getSpecialistId();

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export function getPhotoUrl(fileIdOrUrl: string): string {
  // Direct URLs (e.g. Telegram profile photos) — use as-is
  if (fileIdOrUrl.startsWith('http')) {
    return fileIdOrUrl;
  }
  // File IDs — proxy through our API
  const specialistId = getSpecialistId();
  const query = specialistId ? `?specialist=${specialistId}` : '';
  return `${API_BASE_URL}/api/photo/${fileIdOrUrl}${query}`;
}

export const api = {
  async getSpecialist(): Promise<TSpecialist> {
    return fetchAPI<TSpecialist>('/api/specialist');
  },

  async getSessionTypes(): Promise<TSessionType[]> {
    return fetchAPI<TSessionType[]>('/api/services');
  },

  async getWorkingHours(): Promise<TWorkingHours[]> {
    return fetchAPI<TWorkingHours[]>('/api/working-hours');
  },

  async getDaysOff(): Promise<{ date: string }[]> {
    return fetchAPI<{ date: string }[]>('/api/days-off');
  },

  async getAvailableSlots(date: string, duration: number): Promise<TTimeSlot[]> {
    return fetchAPI<TTimeSlot[]>(`/api/availability?date=${date}&duration=${duration}`);
  },

  async getDurations(): Promise<number[]> {
    return fetchAPI<number[]>('/api/durations');
  },

  async getBookings(): Promise<TBooking[]> {
    return fetchAPI<TBooking[]>('/api/bookings');
  },

  async createBooking(
    duration: number,
    date: string,
    time: string,
    name: string,
    message?: string,
  ): Promise<TBooking> {
    return fetchAPI<TBooking>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ duration, date, time, name, message }),
    });
  },

  async cancelBooking(bookingId: string, reason?: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
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

  // ========== Photo Upload ==========

  async uploadPhoto(file: File): Promise<{ fileId: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return fetchAPI<{ fileId: string }>('/api/upload/photo', {
      method: 'POST',
      body: formData,
    });
  },

  // ========== Client Profile ==========

  async getProfile(): Promise<TClientProfile> {
    return fetchAPI<TClientProfile>('/api/profile');
  },

  async updateProfile(data: {
    name?: string;
    phone?: string;
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

  // ========== Recurring Schedules (Client) ==========

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

  // ========== Recurring Individual Booking Management ==========

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

  // ========== Admin API ==========

  admin: {
    // Profile
    async getProfile(): Promise<TSpecialist> {
      return fetchAPI<TSpecialist>('/api/admin/profile');
    },

    async updateProfile(data: Partial<TSpecialist>): Promise<TSpecialist> {
      return fetchAPI<TSpecialist>('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    // Photo upload (specialist)
    async uploadPhoto(file: File): Promise<{ fileId: string }> {
      const formData = new FormData();
      formData.append('photo', file);
      return fetchAPI<{ fileId: string }>('/api/admin/upload/photo', {
        method: 'POST',
        body: formData,
      });
    },

    // Services
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

    // Working Hours
    async getWorkingHours(): Promise<TWorkingHours[]> {
      return fetchAPI<TWorkingHours[]>('/api/admin/working-hours');
    },

    async updateWorkingHours(hours: TWorkingHours[]): Promise<TWorkingHours[]> {
      return fetchAPI<TWorkingHours[]>('/api/admin/working-hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      });
    },

    async setWorkingHoursForDay(
      day: number,
      startTime: string,
      endTime: string,
    ): Promise<TWorkingHours[]> {
      return fetchAPI<TWorkingHours[]>(`/api/admin/working-hours/${day}`, {
        method: 'PUT',
        body: JSON.stringify({ startTime, endTime }),
      });
    },

    async deleteWorkingHoursForDay(day: number): Promise<void> {
      await fetchAPI<void>(`/api/admin/working-hours/${day}`, {
        method: 'DELETE',
      });
    },

    // Days Off
    async getDaysOff(): Promise<TDayOff[]> {
      return fetchAPI<TDayOff[]>('/api/admin/days-off');
    },

    async createDayOff(date: string, reason?: string): Promise<TDayOff> {
      return fetchAPI<TDayOff>('/api/admin/days-off', {
        method: 'POST',
        body: JSON.stringify({ date, reason }),
      });
    },

    async deleteDayOff(id: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/days-off/${id}`, {
        method: 'DELETE',
      });
    },

    // Bookings
    async getBookings(status?: string): Promise<TBooking[]> {
      const query = status ? `?status=${status}` : '';
      return fetchAPI<TBooking[]>(`/api/admin/bookings${query}`);
    },

    async updateBookingStatus(
      bookingId: string,
      status: string,
      reason?: string,
    ): Promise<TBooking> {
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
      data: { date: string; time: string },
    ): Promise<TBooking> {
      return fetchAPI<TBooking>(`/api/admin/bookings/${bookingId}/reschedule`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    // Durations
    async getDurations(): Promise<number[]> {
      return fetchAPI<number[]>('/api/admin/durations');
    },

    // Clients
    async getClients(): Promise<TClientInfo[]> {
      return fetchAPI<TClientInfo[]>('/api/admin/clients');
    },

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
      await fetchAPI<void>(`/api/admin/clients/${id}`, { method: 'DELETE' });
    },

    // Specialist-initiated bookings
    async createBooking(data: {
      clientId: string;
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

    // Recurring schedules (admin)
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

    // Recurring individual booking management (admin)
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
      await fetchAPI<void>(
        `/api/admin/recurring/${scheduleId}/bookings/${bookingId}/decline-move`,
        {
          method: 'PUT',
        },
      );
    },

    // Notification Preferences
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
  },
};
