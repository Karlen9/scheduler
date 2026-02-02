import { Trainer, SessionType, Booking, TimeSlot, WorkingHours } from "./types";
import { getInitData } from "./telegram";

// API base URL - set via environment variable or default to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const initData = getInitData();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options?.headers || {}),
  };

  if (initData) {
    (headers as Record<string, string>)["X-Telegram-Init-Data"] = initData;
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

  async getAvailableSlots(date: string, sessionType: string): Promise<TimeSlot[]> {
    return fetchAPI<TimeSlot[]>(`/api/availability?date=${date}&sessionType=${sessionType}`);
  },

  async getBookings(): Promise<Booking[]> {
    return fetchAPI<Booking[]>("/api/bookings");
  },

  async createBooking(
    sessionType: string,
    date: string,
    time: string,
    name: string,
    message?: string
  ): Promise<Booking> {
    return fetchAPI<Booking>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        sessionType,
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
    reason: string
  ): Promise<Booking> {
    // Reschedule is done by cancelling and creating a new booking
    await this.cancelBooking(booking.id, reason);
    return this.createBooking(
      booking.sessionType.type,
      date,
      time,
      booking.clientName,
      undefined
    );
  },
};
