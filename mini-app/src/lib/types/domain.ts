export type TSpecialist = {
  id: string;
  name: string;
  timezone: string;
  cancelCutoffHours: number;
  cancelCutoffEnabled?: boolean;
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
  wallpaper?: string;
  referralCode?: string;
  masterBotUsername?: string;
};

type TReferralClient = {
  id: string;
  name: string;
  displayName?: string;
  photoUrl?: string;
  createdAt: string;
  telegramUserId?: number;
  isBlocked?: boolean;
};

export type TReferredSpecialist = {
  id: string;
  name: string;
  botUsername: string;
  createdAt: string;
};

export type TReferralsResponse = {
  code: string;
  link: string;
  count: number;
  referrals: TReferralClient[];
  specialistCount: number;
  specialists: TReferredSpecialist[];
};

export type TSessionType = {
  id: string;
  type: 'common' | 'batch' | string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  imageUrl?: string;
  sessionsCount?: number;
};

export type TClientBatch = {
  id: string;
  clientId: string;
  serviceId: string;
  totalSessions: number;
  remainingSessions: number;
  createdAt: string;
  status: 'active' | 'exhausted' | string;
  service?: TSessionType;
};

export type TWorkingInterval = {
  startTime: string;
  endTime: string;
};

export type TWorkingHours = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TBooking = {
  id: string;
  clientId?: string;
  clientBatchId?: string;
  sessionType?: TSessionType;
  startsAt: string;
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
  createdAt?: string;
  recurringScheduleId?: string;
  replacesBookingId?: string;
  clientIsGhost?: boolean;
  clientIsSelf?: boolean;
  clientTelegramUserId?: number;
  clientTelegramUsername?: string;
};

export type TBookingListResponse = {
  bookings: TBooking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type TTimeSlot = {
  time: string;
  endTime?: string;
  available: boolean;
  mine?: boolean;
  /** Reschedule only: this slot is the booking being moved (its own current time). */
  current?: boolean;
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
  telegramUsername?: string;
  specialistId: string;
  name: string;
  displayName?: string;
  phone?: string;
  photoUrl?: string;
  isGhost?: boolean;
  isSelf?: boolean;
  isBlocked?: boolean;
  createdAt: string;
};

export type TClientListQuery = {
  page: number;
  limit: number;
  search?: string;
};

export type TClientListResponse = {
  clients: TClientInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchQuery?: string;
};

export type TDayOff = {
  id: string;
  date: string;
  reason?: string;
  createdAt: string;
};

export type TScheduleMode = 'weekly' | 'dates';

/** A date the specialist opened for booking (dates schedule mode). Intervals are effective ones. */
export type TWorkDate = {
  date: string;
  intervals: TWorkingInterval[];
};

/** Admin view of a work date; `custom` is true when the day has its own hours. */
export type TAdminWorkDate = TWorkDate & {
  custom: boolean;
  /** Active bookings on the date. Absent on older backends and mock data: treat as 0. */
  bookingCount?: number;
};

/** A date with active bookings (open or not). */
export type TBookedDate = {
  date: string;
  bookingCount: number;
};

export type TScheduleContext = {
  workingHours: TWorkingHours[];
  daysOff: { date: string }[];
  /** Absent on older backends and mock data: treat as 'weekly'. */
  scheduleMode?: TScheduleMode;
  /** Absent on older backends and mock data: treat as []. */
  workDates?: TWorkDate[];
};

export type TAdminScheduleContext = {
  workingHours: TWorkingHours[];
  daysOff: TDayOff[];
  scheduleMode?: TScheduleMode;
  defaultIntervals?: TWorkingInterval[];
  /** Starts at the Monday of the previous week: past dates are read-only context. */
  workDates?: TAdminWorkDate[];
  /** Every date from the previous Monday onward that has active bookings, open or not. */
  bookedDates?: TBookedDate[];
};

export type TScheduleSettings = {
  scheduleMode: TScheduleMode;
  defaultIntervals: TWorkingInterval[];
  autoOpened: number;
};

/** One entry of the work-dates diff: `intervals: null` means "use the default hours". */
export type TWorkDateOpenInput = {
  date: string;
  intervals: TWorkingInterval[] | null;
};

export type TWorkDatesUpdate = {
  open: TWorkDateOpenInput[];
  close: string[];
};

export type TRecurringSchedule = {
  id: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  clientIsSelf?: boolean;
  dayOfWeek: number;
  time: string;
  durationMinutes: number;
  status: 'pending' | 'active' | 'declined' | 'cancelled';
  createdBy: 'client' | 'specialist';
  createdAt: string;
  sessionTypeId?: string;
  sessionType?: TSessionType;
  daysOfWeek?: string;
  startDate?: string;
  endDate?: string;
  dayTimes?: string;
  bookings?: TBooking[];
};

export type TRecurringPreviewResponse = {
  dates: string[];
  count: number;
};

export type TRoomColor = 'green' | 'violet' | 'orange' | 'blue' | 'pink' | 'teal';

export type TRoomMember = {
  id: string;
  name: string;
  color: string;
  /** True for a real specialist with a bot; false for an offline colleague kept by the creator. */
  linked?: boolean;
  isMe?: boolean;
  hasInvite?: boolean;
};

/** One date of the room and who owns it. Dates before today are read-only history. */
export type TRoomDay = {
  date: string;
  memberId: string;
  /** Only for the caller's own days and linked colleagues' days; never client data. */
  hasBookings?: boolean;
};

export type TRoomRequests = {
  incoming: { id: string; date: string; fromMemberId: string }[];
  outgoing: { id: string; date: string; toMemberId: string }[];
};

/** `GET /api/admin/room`: `room: null` (or a failed request) means solo mode. */
export type TRoomResponse = {
  room: { id: string; name: string; isCreator?: boolean } | null;
  meMemberId?: string;
  members?: TRoomMember[];
  /** Starts at the Monday of the previous week, like admin work dates. */
  days?: TRoomDay[];
  requests?: TRoomRequests;
};

export type TRoomDayAssign = {
  date: string;
  /** Member id, or "" to free the day. */
  memberId: string;
};
