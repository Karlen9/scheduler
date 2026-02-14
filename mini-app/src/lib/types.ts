export interface Trainer {
  id: string;
  name: string;
  timezone: string;
  cancelCutoffHours: number;
  botUsername?: string;
  telegramHandle?: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  photoUrl?: string;
  gymLatitude?: number;
  gymLongitude?: number;
}

export interface SessionType {
  id: string;
  type: "personal" | "pair" | "consultation";
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
}

export interface WorkingHours {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "09:00"
  endTime: string; // "18:00"
}

export interface Booking {
  id: string;
  sessionType?: SessionType;
  startsAt: string; // ISO datetime
  endsAt: string;
  clientName: string;
  clientPhotoUrl?: string;
  clientMessage?: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed" | "cancel_requested" | "reschedule_pending";
  cancelReason?: string;
  cancelledBy?: "client" | "trainer";
  durationMinutes?: number;
  createdBy?: "client" | "trainer";
  recurringScheduleId?: string;
  replacesBookingId?: string;
}

export interface TimeSlot {
  time: string; // "09:00"
  endTime?: string; // "10:00"
  available: boolean;
}

export interface ClientProfile {
  id: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  preferredDuration?: number;
  notifyBookingStatus?: boolean;
  notifyReminders?: boolean;
  notifyDaysOff?: boolean;
}

export interface ClientInfo {
  id: string;
  telegramUserId: number;
  trainerId: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  createdAt: string;
}

export interface DayOff {
  id: string;
  date: string; // ISO date string
  reason?: string;
  createdAt: string;
}

export interface RecurringSchedule {
  id: string;
  clientName: string;
  clientPhotoUrl?: string;
  dayOfWeek: number;           // kept for backward compat
  time: string;
  durationMinutes: number;
  status: "pending" | "active" | "declined" | "cancelled";
  createdBy: "client" | "trainer";
  createdAt: string;
  // Phase 2 fields
  sessionTypeId?: string;
  sessionType?: SessionType;
  daysOfWeek?: string;          // comma-separated: "1,3,5"
  startDate?: string;           // "2026-02-17"
  endDate?: string;             // "2026-05-17"
  bookings?: Booking[];
}

export interface RecurringPreviewResponse {
  dates: string[];
  count: number;
}
