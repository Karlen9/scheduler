import { fetchMockAPI } from './mock-api';
import { emitMutation } from './mutation-events';
import { dedupeRequest } from './request-cache';
import { isTestRoute } from './routes';
import { getSpecialistId, waitForInitData } from './telegram';

import type {
  TAdminScheduleContext,
  TAdminStats,
  TBooking,
  TChangeVersions,
  TClientInfo,
  TClientProfile,
  TClientStats,
  TDayOff,
  TRecurringPreviewResponse,
  TRecurringSchedule,
  TScheduleContext,
  TSessionType,
  TSpecialist,
  TTimeSlot,
  TWorkingHours,
  TWorkingInterval,
} from './types';

/***************************************************************************************************
 * API calls use relative URLs — Next.js rewrites proxy them to the backend.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
const API_BASE_URL = '';

/***************************************************************************************************
 * Implements the fetch api logic used by this module.
 *
 * Parameters:
 * - endpoint: API endpoint or path used by the request.
 * - options: Options used by the current operation.
 *
 * Returns:
 * - A promise that resolves with T.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (isTestRoute()) {
    return fetchMockAPI<T>(endpoint, options);
  }

  /***************************************************************************************************
   * Defines the init data value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const initData = await waitForInitData();
  /***************************************************************************************************
   * Defines the specialist id value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const specialistId = getSpecialistId();
  /***************************************************************************************************
   * Defines the method value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const method = (options?.method ?? 'GET').toUpperCase();

  /***************************************************************************************************
   * Defines the is form data value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Defines the request value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const request = async (): Promise<T> => {
    /***************************************************************************************************
     * Defines the response value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      cache: options?.cache ?? 'no-store',
      headers,
    });

    if (!response.ok) {
      /***************************************************************************************************
       * Defines the error text value used by the shared utility layer.
       *
       * Usage context:
       * - Reused by the shared utility layer to keep shared values centralized.
       ***************************************************************************************************/
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    const data = response.status === 204 ? (undefined as T) : await response.json();

    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      emitMutation({ method, endpoint });
    }

    return data;
  };

  if (method === 'GET') {
    /***************************************************************************************************
     * Defines the request key value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const requestKey = [method, endpoint, specialistId ?? '', initData].join(':');
    return dedupeRequest(requestKey, request);
  }

  return request();
}

/***************************************************************************************************
 * Returns photo url.
 *
 * Parameters:
 * - fileIdOrUrl: File id or url used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May read browser state, call shared helpers, or perform network requests.
 ***************************************************************************************************/
export function getPhotoUrl(fileIdOrUrl: string): string {
  /***************************************************************************************************
   * Direct URLs (e.g. Telegram profile photos) — use as-is.
   ***************************************************************************************************/
  if (
    fileIdOrUrl.startsWith('http') ||
    fileIdOrUrl.startsWith('data:') ||
    fileIdOrUrl.startsWith('blob:')
  ) {
    return fileIdOrUrl;
  }
  /***************************************************************************************************
   * File IDs — proxy through our API.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const specialistId = getSpecialistId();
  /***************************************************************************************************
   * Defines the query value used by the shared utility layer.
   *
   * Usage context:
   * - Reused by the shared utility layer to keep shared values centralized.
   ***************************************************************************************************/
  const query = specialistId ? `?specialist=${specialistId}` : '';
  return `${API_BASE_URL}/api/photo/${fileIdOrUrl}${query}`;
}

/***************************************************************************************************
 * Defines the api value used by the shared utility layer.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
export const api = {
  /***************************************************************************************************
   * Returns specialist.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TSpecialist.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getSpecialist(): Promise<TSpecialist> {
    return fetchAPI<TSpecialist>('/api/specialist');
  },

  /***************************************************************************************************
   * Returns session types.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TSessionType[].
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getSessionTypes(): Promise<TSessionType[]> {
    return fetchAPI<TSessionType[]>('/api/services');
  },

  /***************************************************************************************************
   * Returns working hours.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TWorkingHours[].
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getWorkingHours(): Promise<TWorkingHours[]> {
    return fetchAPI<TWorkingHours[]>('/api/working-hours');
  },

  /***************************************************************************************************
   * Returns schedule context.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TScheduleContext.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getScheduleContext(): Promise<TScheduleContext> {
    return fetchAPI<TScheduleContext>('/api/schedule-context');
  },

  /***************************************************************************************************
   * Returns days off.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - The computed value for the current operation as Promise<.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getDaysOff(): Promise<{ date: string }[]> {
    return fetchAPI<{ date: string }[]>('/api/days-off');
  },

  /***************************************************************************************************
   * Returns available slots.
   *
   * Parameters:
   * - date: Date value used by the current operation.
   * - duration: Duration value used by the current operation.
   *
   * Returns:
   * - A promise that resolves with TTimeSlot[].
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getAvailableSlots(date: string, duration: number): Promise<TTimeSlot[]> {
    return fetchAPI<TTimeSlot[]>(`/api/availability?date=${date}&duration=${duration}`);
  },

  /***************************************************************************************************
   * Returns bookings.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TBooking[].
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getBookings(): Promise<TBooking[]> {
    return fetchAPI<TBooking[]>('/api/bookings');
  },

  /***************************************************************************************************
   * Returns client analytics.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TClientStats.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getClientStats(): Promise<TClientStats> {
    return fetchAPI<TClientStats>('/api/stats');
  },

  /***************************************************************************************************
   * Returns lightweight resource change versions for frontend cache sync.
   ***************************************************************************************************/
  async getChangeVersions(): Promise<TChangeVersions> {
    return fetchAPI<TChangeVersions>('/api/changes');
  },

  /***************************************************************************************************
   * Creates booking.
   *
   * Parameters:
   * - duration: Duration value used by the current operation.
   * - date: Date value used by the current operation.
   * - time: Time value used by the current operation.
   * - name: Name used by the current operation.
   * - message: Message used by the current operation.
   *
   * Returns:
   * - A promise that resolves with TBooking.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Implements the cancel booking logic used by this module.
   *
   * Parameters:
   * - bookingId: Identifier used to target the current record.
   * - reason: Reason used by the current operation.
   *
   * Returns:
   * - A promise that resolves with TBooking.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async cancelBooking(bookingId: string, reason?: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  /***************************************************************************************************
   * Implements the confirm booking logic used by this module.
   *
   * Parameters:
   * - bookingId: Identifier used to target the current record.
   *
   * Returns:
   * - A promise that resolves with TBooking.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async confirmBooking(bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}/confirm`, {
      method: 'PUT',
    });
  },

  /***************************************************************************************************
   * Implements the decline booking logic used by this module.
   *
   * Parameters:
   * - bookingId: Identifier used to target the current record.
   *
   * Returns:
   * - A promise that resolves with TBooking.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async declineBooking(bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/bookings/${bookingId}/decline`, {
      method: 'PUT',
    });
  },

  /***************************************************************************************************
   * Photo Upload.
   *
   * Parameters:
   * - file: File used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as Promise<.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async uploadPhoto(file: File): Promise<{ fileId: string }> {
    /***************************************************************************************************
     * Defines the form data value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const formData = new FormData();
    formData.append('photo', file);
    return fetchAPI<{ fileId: string }>('/api/upload/photo', {
      method: 'POST',
      body: formData,
    });
  },

  /***************************************************************************************************
   * Client Profile.
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TClientProfile.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getProfile(): Promise<TClientProfile> {
    return fetchAPI<TClientProfile>('/api/profile');
  },

  /***************************************************************************************************
   * Updates profile.
   *
   * Parameters:
   * - data: Input data consumed by the current operation.
   *
   * Returns:
   * - A promise that resolves with TClientProfile.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Updates notification prefs.
   *
   * Parameters:
   * - prefs: Prefs used by the current operation.
   *
   * Returns:
   * - A promise that resolves with TClientProfile.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Recurring Schedules (Client).
   *
   * Parameters:
   * - None.
   *
   * Returns:
   * - A promise that resolves with TRecurringSchedule[].
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getRecurringSchedules(): Promise<TRecurringSchedule[]> {
    return fetchAPI<TRecurringSchedule[]>('/api/recurring');
  },

  /***************************************************************************************************
   * Returns recurring schedule detail.
   *
   * Parameters:
   * - id: Identifier used to target the current record.
   *
   * Returns:
   * - A promise that resolves with TRecurringSchedule.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async getRecurringScheduleDetail(id: string): Promise<TRecurringSchedule> {
    return fetchAPI<TRecurringSchedule>(`/api/recurring/${id}`);
  },

  /***************************************************************************************************
   * Creates recurring schedule.
   *
   * Parameters:
   * - data: Input data consumed by the current operation.
   *
   * Returns:
   * - A promise that resolves with TRecurringSchedule.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Implements the preview recurring schedule logic used by this module.
   *
   * Parameters:
   * - data: Input data consumed by the current operation.
   *
   * Returns:
   * - A promise that resolves with TRecurringPreviewResponse.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Implements the cancel recurring schedule logic used by this module.
   *
   * Parameters:
   * - id: Identifier used to target the current record.
   *
   * Returns:
   * - A promise that resolves with void.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async cancelRecurringSchedule(id: string): Promise<void> {
    await fetchAPI<void>(`/api/recurring/${id}`, { method: 'DELETE' });
  },

  /***************************************************************************************************
   * Recurring Individual Booking Management.
   *
   * Parameters:
   * - scheduleId: Identifier used to target the current record.
   * - bookingId: Identifier used to target the current record.
   *
   * Returns:
   * - A promise that resolves with TBooking.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
  async requestCancelBooking(scheduleId: string, bookingId: string): Promise<TBooking> {
    return fetchAPI<TBooking>(`/api/recurring/${scheduleId}/bookings/${bookingId}/cancel-request`, {
      method: 'PUT',
    });
  },

  /***************************************************************************************************
   * Implements the request move booking logic used by this module.
   *
   * Parameters:
   * - scheduleId: Identifier used to target the current record.
   * - bookingId: Identifier used to target the current record.
   * - data: Input data consumed by the current operation.
   *
   * Returns:
   * - A promise that resolves with TBooking.
   *
   * Side effects:
   * - May read browser state, call shared helpers, or perform network requests.
   ***************************************************************************************************/
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

  /***************************************************************************************************
   * Admin API.
   ***************************************************************************************************/
  admin: {
    /***************************************************************************************************
     * Profile.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TSpecialist.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getProfile(): Promise<TSpecialist> {
      return fetchAPI<TSpecialist>('/api/admin/profile');
    },

    /***************************************************************************************************
     * Updates profile.
     *
     * Parameters:
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TSpecialist.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async updateProfile(data: Partial<TSpecialist>): Promise<TSpecialist> {
      return fetchAPI<TSpecialist>('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    /***************************************************************************************************
     * Photo upload (specialist).
     *
     * Parameters:
     * - file: File used by the current operation.
     *
     * Returns:
     * - The computed value for the current operation as Promise<.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async uploadPhoto(file: File): Promise<{ fileId: string }> {
      /***************************************************************************************************
       * Defines the form data value used by the shared utility layer.
       *
       * Usage context:
       * - Reused by the shared utility layer to keep shared values centralized.
       ***************************************************************************************************/
      const formData = new FormData();
      formData.append('photo', file);
      return fetchAPI<{ fileId: string }>('/api/admin/upload/photo', {
        method: 'POST',
        body: formData,
      });
    },

    /***************************************************************************************************
     * Services.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TSessionType[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getServices(): Promise<TSessionType[]> {
      return fetchAPI<TSessionType[]>('/api/admin/services');
    },

    /***************************************************************************************************
     * Creates service.
     *
     * Parameters:
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TSessionType.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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

    /***************************************************************************************************
     * Updates service.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TSessionType.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async updateService(id: string, data: Partial<TSessionType>): Promise<TSessionType> {
      return fetchAPI<TSessionType>(`/api/admin/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    /***************************************************************************************************
     * Deletes service.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with void.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async deleteService(id: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/services/${id}`, {
        method: 'DELETE',
      });
    },

    /***************************************************************************************************
     * Working Hours.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TWorkingHours[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getWorkingHours(): Promise<TWorkingHours[]> {
      return fetchAPI<TWorkingHours[]>('/api/admin/working-hours');
    },

    /***************************************************************************************************
     * Returns schedule context.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TAdminScheduleContext.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getScheduleContext(): Promise<TAdminScheduleContext> {
      return fetchAPI<TAdminScheduleContext>('/api/admin/schedule-context');
    },

    /***************************************************************************************************
     * Updates working hours.
     *
     * Parameters:
     * - hours: Hours used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TWorkingHours[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async updateWorkingHours(hours: TWorkingHours[]): Promise<TWorkingHours[]> {
      return fetchAPI<TWorkingHours[]>('/api/admin/working-hours', {
        method: 'PUT',
        body: JSON.stringify({ hours }),
      });
    },

    /***************************************************************************************************
     * Sets working hours for day.
     *
     * Parameters:
     * - day: Day used by the current operation.
     * - startTime: Time value used by the current operation.
     * - endTime: Time value used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TWorkingHours[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async setWorkingHoursForDay(
      day: number,
      intervals: TWorkingInterval[],
    ): Promise<TWorkingHours[]> {
      return fetchAPI<TWorkingHours[]>(`/api/admin/working-hours/${day}`, {
        method: 'PUT',
        body: JSON.stringify({ hours: intervals }),
      });
    },

    /***************************************************************************************************
     * Deletes working hours for day.
     *
     * Parameters:
     * - day: Day used by the current operation.
     *
     * Returns:
     * - A promise that resolves with void.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async deleteWorkingHoursForDay(day: number): Promise<void> {
      await fetchAPI<void>(`/api/admin/working-hours/${day}`, {
        method: 'DELETE',
      });
    },

    /***************************************************************************************************
     * Days Off.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TDayOff[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getDaysOff(): Promise<TDayOff[]> {
      return fetchAPI<TDayOff[]>('/api/admin/days-off');
    },

    /***************************************************************************************************
     * Creates day off.
     *
     * Parameters:
     * - date: Date value used by the current operation.
     * - reason: Reason used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TDayOff.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async createDayOff(date: string, reason?: string): Promise<TDayOff> {
      return fetchAPI<TDayOff>('/api/admin/days-off', {
        method: 'POST',
        body: JSON.stringify({ date, reason }),
      });
    },

    /***************************************************************************************************
     * Deletes day off.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with void.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async deleteDayOff(id: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/days-off/${id}`, {
        method: 'DELETE',
      });
    },

    /***************************************************************************************************
     * Bookings.
     *
     * Parameters:
     * - status: Status used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TBooking[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getBookings(status?: string): Promise<TBooking[]> {
      /***************************************************************************************************
       * Defines the query value used by the shared utility layer.
       *
       * Usage context:
       * - Reused by the shared utility layer to keep shared values centralized.
       ***************************************************************************************************/
      const query = status ? `?status=${status}` : '';
      return fetchAPI<TBooking[]>(`/api/admin/bookings${query}`);
    },

    /***************************************************************************************************
     * Returns admin analytics.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TAdminStats.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getAdminStats(): Promise<TAdminStats> {
      return fetchAPI<TAdminStats>('/api/admin/stats');
    },

    /***************************************************************************************************
     * Updates booking status.
     *
     * Parameters:
     * - bookingId: Identifier used to target the current record.
     * - status: Status used by the current operation.
     * - reason: Reason used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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

    /***************************************************************************************************
     * Implements the cancel booking logic used by this module.
     *
     * Parameters:
     * - bookingId: Identifier used to target the current record.
     * - reason: Reason used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async cancelBooking(bookingId: string, reason?: string): Promise<TBooking> {
      return this.updateBookingStatus(bookingId, 'cancelled', reason);
    },

    /***************************************************************************************************
     * Implements the reschedule booking logic used by this module.
     *
     * Parameters:
     * - bookingId: Identifier used to target the current record.
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async rescheduleBooking(
      bookingId: string,
      data: { date: string; time: string },
    ): Promise<TBooking> {
      return fetchAPI<TBooking>(`/api/admin/bookings/${bookingId}/reschedule`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    /***************************************************************************************************
     * Clients.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TClientInfo[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getClients(): Promise<TClientInfo[]> {
      return fetchAPI<TClientInfo[]>('/api/admin/clients');
    },

    /***************************************************************************************************
     * Creates ghost client.
     *
     * Parameters:
     * - name: Name used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TClientInfo.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async createGhostClient(name: string): Promise<TClientInfo> {
      return fetchAPI<TClientInfo>('/api/admin/clients', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },

    /***************************************************************************************************
     * Updates client.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     * - name: Name used by the current operation.
     *
     * Returns:
     * - A promise that resolves with TClientInfo.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async updateClient(id: string, name: string): Promise<TClientInfo> {
      return fetchAPI<TClientInfo>(`/api/admin/clients/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
    },

    /***************************************************************************************************
     * Deletes client.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with void.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async deleteClient(id: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/clients/${id}`, { method: 'DELETE' });
    },

    /***************************************************************************************************
     * Specialist-initiated bookings.
     *
     * Parameters:
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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

    /***************************************************************************************************
     * Recurring schedules (admin).
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - A promise that resolves with TRecurringSchedule[].
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getRecurringSchedules(): Promise<TRecurringSchedule[]> {
      return fetchAPI<TRecurringSchedule[]>('/api/admin/recurring');
    },

    /***************************************************************************************************
     * Returns recurring schedule detail.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with TRecurringSchedule.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getRecurringScheduleDetail(id: string): Promise<TRecurringSchedule> {
      return fetchAPI<TRecurringSchedule>(`/api/admin/recurring/${id}`);
    },

    /***************************************************************************************************
     * Creates recurring schedule.
     *
     * Parameters:
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TRecurringSchedule.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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

    /***************************************************************************************************
     * Implements the preview recurring schedule logic used by this module.
     *
     * Parameters:
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TRecurringPreviewResponse.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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

    /***************************************************************************************************
     * Implements the approve recurring schedule logic used by this module.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with TRecurringSchedule.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async approveRecurringSchedule(id: string): Promise<TRecurringSchedule> {
      return fetchAPI<TRecurringSchedule>(`/api/admin/recurring/${id}/approve`, {
        method: 'PUT',
      });
    },

    /***************************************************************************************************
     * Implements the decline recurring schedule logic used by this module.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with TRecurringSchedule.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async declineRecurringSchedule(id: string): Promise<TRecurringSchedule> {
      return fetchAPI<TRecurringSchedule>(`/api/admin/recurring/${id}/decline`, {
        method: 'PUT',
      });
    },

    /***************************************************************************************************
     * Implements the cancel recurring schedule logic used by this module.
     *
     * Parameters:
     * - id: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with void.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async cancelRecurringSchedule(id: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/recurring/${id}`, { method: 'DELETE' });
    },

    /***************************************************************************************************
     * Recurring individual booking management (admin).
     *
     * Parameters:
     * - scheduleId: Identifier used to target the current record.
     * - bookingId: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async requestCancelBooking(scheduleId: string, bookingId: string): Promise<TBooking> {
      return fetchAPI<TBooking>(
        `/api/admin/recurring/${scheduleId}/bookings/${bookingId}/cancel-request`,
        {
          method: 'PUT',
        },
      );
    },

    /***************************************************************************************************
     * Implements the request move booking logic used by this module.
     *
     * Parameters:
     * - scheduleId: Identifier used to target the current record.
     * - bookingId: Identifier used to target the current record.
     * - data: Input data consumed by the current operation.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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

    /***************************************************************************************************
     * Implements the approve move booking logic used by this module.
     *
     * Parameters:
     * - scheduleId: Identifier used to target the current record.
     * - bookingId: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with TBooking.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async approveMoveBooking(scheduleId: string, bookingId: string): Promise<TBooking> {
      return fetchAPI<TBooking>(
        `/api/admin/recurring/${scheduleId}/bookings/${bookingId}/approve-move`,
        {
          method: 'PUT',
        },
      );
    },

    /***************************************************************************************************
     * Implements the decline move booking logic used by this module.
     *
     * Parameters:
     * - scheduleId: Identifier used to target the current record.
     * - bookingId: Identifier used to target the current record.
     *
     * Returns:
     * - A promise that resolves with void.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async declineMoveBooking(scheduleId: string, bookingId: string): Promise<void> {
      await fetchAPI<void>(
        `/api/admin/recurring/${scheduleId}/bookings/${bookingId}/decline-move`,
        {
          method: 'PUT',
        },
      );
    },

    /***************************************************************************************************
     * Notification Preferences.
     *
     * Parameters:
     * - None.
     *
     * Returns:
     * - The computed value for the current operation as Promise<.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
    async getNotificationPrefs(): Promise<{
      notifyNewBookings: boolean;
      notifyCancellations: boolean;
    }> {
      return fetchAPI('/api/admin/notifications');
    },

    /***************************************************************************************************
     * Updates notification prefs.
     *
     * Parameters:
     * - prefs: Prefs used by the current operation.
     *
     * Returns:
     * - The computed value for the current operation as Promise<.
     *
     * Side effects:
     * - May read browser state, call shared helpers, or perform network requests.
     ***************************************************************************************************/
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
