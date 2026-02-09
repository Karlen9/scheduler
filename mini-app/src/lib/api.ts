import { Trainer, SessionType, Booking, TimeSlot, WorkingHours, DayOff, ClientProfile, ClientInfo } from "./types";
import { getInitData, getTrainerId } from "./telegram";

// API base URL - set via environment variable or default to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const initData = getInitData();
  const trainerId = getTrainerId();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options?.headers || {}),
  };

  if (initData) {
    (headers as Record<string, string>)["X-Telegram-Init-Data"] = initData;
  }

  if (trainerId) {
    (headers as Record<string, string>)["X-Trainer-ID"] = trainerId;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  async getTrainer(): Promise<Trainer> {
    return fetchAPI<Trainer>("/api/trainer");
  },

  async getSessionTypes(): Promise<SessionType[]> {
    return fetchAPI<SessionType[]>("/api/services");
  },

  async getWorkingHours(): Promise<WorkingHours[]> {
    return fetchAPI<WorkingHours[]>("/api/working-hours");
  },

  async getDaysOff(): Promise<{ date: string }[]> {
    return fetchAPI<{ date: string }[]>("/api/days-off");
  },

  async getAvailableSlots(
    date: string,
    duration: number,
  ): Promise<TimeSlot[]> {
    return fetchAPI<TimeSlot[]>(
      `/api/availability?date=${date}&duration=${duration}`,
    );
  },

  async getDurations(): Promise<number[]> {
    return fetchAPI<number[]>("/api/durations");
  },

  async getBookings(): Promise<Booking[]> {
    return fetchAPI<Booking[]>("/api/bookings");
  },

  async createBooking(
    duration: number,
    date: string,
    time: string,
    name: string,
    message?: string,
  ): Promise<Booking> {
    return fetchAPI<Booking>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        duration,
        date,
        time,
        name,
        message,
      }),
    });
  },

  async cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
    return fetchAPI<Booking>(`/api/bookings/${bookingId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    });
  },

  async rescheduleBooking(
    booking: Booking,
    date: string,
    time: string,
    reason: string,
  ): Promise<Booking> {
    // Reschedule is done by cancelling and creating a new booking
    const duration = booking.durationMinutes || booking.sessionType?.durationMinutes || 60;
    await this.cancelBooking(booking.id, reason);
    return this.createBooking(
      duration,
      date,
      time,
      booking.clientName,
      undefined,
    );
  },

  // ========== Client Profile ==========

  async getProfile(): Promise<ClientProfile> {
    return fetchAPI<ClientProfile>("/api/profile");
  },

  async updateProfile(data: { name?: string; phone?: string; preferredDuration?: number }): Promise<ClientProfile> {
    return fetchAPI<ClientProfile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // ========== Admin API ==========

  admin: {
    // Profile
    async getProfile(): Promise<Trainer> {
      return fetchAPI<Trainer>("/api/admin/profile");
    },

    async updateProfile(data: Partial<Trainer>): Promise<Trainer> {
      return fetchAPI<Trainer>("/api/admin/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },

    // Services
    async getServices(): Promise<SessionType[]> {
      return fetchAPI<SessionType[]>("/api/admin/services");
    },

    async createService(data: {
      type: string;
      name: string;
      durationMinutes: number;
      price: number;
      currency?: string;
    }): Promise<SessionType> {
      return fetchAPI<SessionType>("/api/admin/services", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    async updateService(
      type: string,
      data: Partial<SessionType>,
    ): Promise<SessionType> {
      return fetchAPI<SessionType>(`/api/admin/services/${type}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },

    async deleteService(type: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/services/${type}`, {
        method: "DELETE",
      });
    },

    // Working Hours
    async getWorkingHours(): Promise<WorkingHours[]> {
      return fetchAPI<WorkingHours[]>("/api/admin/working-hours");
    },

    async updateWorkingHours(hours: WorkingHours[]): Promise<WorkingHours[]> {
      return fetchAPI<WorkingHours[]>("/api/admin/working-hours", {
        method: "PUT",
        body: JSON.stringify({ hours }),
      });
    },

    async setWorkingHoursForDay(
      day: number,
      startTime: string,
      endTime: string,
    ): Promise<WorkingHours[]> {
      return fetchAPI<WorkingHours[]>(`/api/admin/working-hours/${day}`, {
        method: "PUT",
        body: JSON.stringify({ startTime, endTime }),
      });
    },

    async deleteWorkingHoursForDay(day: number): Promise<void> {
      await fetchAPI<void>(`/api/admin/working-hours/${day}`, {
        method: "DELETE",
      });
    },

    // Days Off
    async getDaysOff(): Promise<DayOff[]> {
      return fetchAPI<DayOff[]>("/api/admin/days-off");
    },

    async createDayOff(date: string, reason?: string): Promise<DayOff> {
      return fetchAPI<DayOff>("/api/admin/days-off", {
        method: "POST",
        body: JSON.stringify({ date, reason }),
      });
    },

    async deleteDayOff(id: string): Promise<void> {
      await fetchAPI<void>(`/api/admin/days-off/${id}`, {
        method: "DELETE",
      });
    },

    // Bookings
    async getBookings(status?: string): Promise<Booking[]> {
      const query = status ? `?status=${status}` : "";
      return fetchAPI<Booking[]>(`/api/admin/bookings${query}`);
    },

    async updateBookingStatus(
      bookingId: string,
      status: string,
    ): Promise<Booking> {
      return fetchAPI<Booking>(`/api/admin/bookings/${bookingId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    },

    async cancelBooking(bookingId: string, reason?: string): Promise<Booking> {
      return this.updateBookingStatus(bookingId, "cancelled");
    },

    // Durations
    async getDurations(): Promise<number[]> {
      return fetchAPI<number[]>("/api/admin/durations");
    },

    async updateDurations(durations: number[]): Promise<number[]> {
      return fetchAPI<number[]>("/api/admin/durations", {
        method: "PUT",
        body: JSON.stringify({ durations }),
      });
    },

    // Clients
    async getClients(): Promise<ClientInfo[]> {
      return fetchAPI<ClientInfo[]>("/api/admin/clients");
    },
  },
};
