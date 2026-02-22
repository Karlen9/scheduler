import type { Dispatch, SetStateAction } from 'react';

export type TSpecialist = {
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
  locationLatitude?: number;
  locationLongitude?: number;
  isOwner?: boolean;
  language?: string;
};

export type TSessionType = {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  imageUrl?: string;
};

export type TWorkingHours = {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "09:00"
  endTime: string; // "18:00"
};

export type TBooking = {
  id: string;
  sessionType?: TSessionType;
  startsAt: string; // ISO datetime
  endsAt: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  clientMessage?: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'cancel_requested'
    | 'reschedule_pending';
  cancelReason?: string;
  cancelledBy?: 'client' | 'specialist';
  durationMinutes?: number;
  createdBy?: 'client' | 'specialist';
  recurringScheduleId?: string;
  replacesBookingId?: string;
};

export type TTimeSlot = {
  time: string; // "09:00"
  endTime?: string; // "10:00"
  available: boolean;
};

export type TClientProfile = {
  id: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  preferredDuration?: number;
  notifyBookingStatus?: boolean;
  notifyReminders?: boolean;
  notifyDaysOff?: boolean;
  notifyCancellations?: boolean;
  language?: string;
};

export type TClientInfo = {
  id: string;
  telegramUserId: number;
  specialistId: string;
  name: string;
  displayName?: string;
  phone?: string;
  photoUrl?: string;
  isGhost?: boolean;
  createdAt: string;
};

export type TDayOff = {
  id: string;
  date: string; // ISO date string
  reason?: string;
  createdAt: string;
};

export type TRecurringSchedule = {
  id: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  dayOfWeek: number; // kept for backward compat
  time: string;
  durationMinutes: number;
  status: 'pending' | 'active' | 'declined' | 'cancelled';
  createdBy: 'client' | 'specialist';
  createdAt: string;
  // Phase 2 fields
  sessionTypeId?: string;
  sessionType?: TSessionType;
  daysOfWeek?: string; // comma-separated: "1,3,5"
  startDate?: string; // "2026-02-17"
  endDate?: string; // "2026-05-17"
  dayTimes?: string; // JSON: '{"1":"09:00","3":"10:30"}'
  bookings?: TBooking[];
};

export type TRecurringPreviewResponse = {
  dates: string[];
  count: number;
};

export type TCreateBookingParams = {
  clientId?: string;
  duration: number;
  date: string;
  time: string;
  message?: string;
};

export type TCreateRecurringParams = {
  clientId?: string;
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
};

export type TPreviewRecurringParams = {
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
};

export type TBookingFormProps = {
  services: TSessionType[];
  workingHours: TWorkingHours[];
  daysOff: string[];
  isLoading: boolean;
  clients?: TClientInfo[];
  showRecurring?: boolean;
  bookedDates?: string[];
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  onCreateGhostClient?: (name: string) => Promise<TClientInfo>;
  successRedirect: string;
  title?: string;
};

export type TRecurringDayFormProps = {
  services: TSessionType[];
  recService: TSessionType | null;
  setRecService: Dispatch<SetStateAction<TSessionType | null>>;
  activeDay: number | null;
  handleDayClick: (day: number) => void;
  dayTimeMap: Record<number, string>;
  timeSlotsForActiveDay: string[];
  hasDayTimes: boolean;
  selectedPeriod: string;
  recFormReady: boolean;
  setSelectedPeriod: (value: SetStateAction<string>) => void;
  isPreviewing: boolean;
  handlePreview: () => Promise<void>;
  previewDates: string[] | null;
  handleRecTimeSelect: (time: string) => void;
};

export type TVoidFunction = () => void;
