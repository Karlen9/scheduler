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
  clientMessage?: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed";
  cancelReason?: string;
  cancelledBy?: "client" | "trainer";
  durationMinutes?: number;
  createdBy?: "client" | "trainer";
  recurringScheduleId?: string;
}

export interface TimeSlot {
  time: string; // "09:00"
  endTime?: string; // "10:00"
  available: boolean;
  waitlistCount?: number;
  hasMyWaitlist?: boolean;
}

export interface WaitlistEntry {
  id: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  clientName: string;
  status: "waiting" | "offered" | "booked" | "declined" | "expired" | "cancelled";
  offeredAt?: string;
  createdAt: string;
  position?: number;
}

export interface ClientProfile {
  id: string;
  name: string;
  phone?: string;
  preferredDuration?: number;
  notifyBookingStatus?: boolean;
  notifyReminders?: boolean;
  notifyDaysOff?: boolean;
  notifyWaitlist?: boolean;
}

export interface ClientInfo {
  id: string;
  telegramUserId: number;
  trainerId: string;
  name: string;
  phone?: string;
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
  dayOfWeek: number;
  time: string;
  durationMinutes: number;
  status: "active" | "paused" | "cancelled";
  createdBy: "client" | "trainer";
  createdAt: string;
}
