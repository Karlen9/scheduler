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
  gymAddress?: string;
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
  sessionType: SessionType;
  startsAt: string; // ISO datetime
  endsAt: string;
  clientName: string;
  clientMessage?: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed";
  cancelReason?: string;
  cancelledBy?: "client" | "trainer";
}

export interface TimeSlot {
  time: string; // "09:00"
  available: boolean;
}

export interface DayOff {
  id: string;
  date: string; // ISO date string
  reason?: string;
  createdAt: string;
}
