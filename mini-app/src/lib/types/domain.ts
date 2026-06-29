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
  wallpaper?: string;
  referralCode?: string;
  isPro?: boolean;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  currentPeriodEndAt?: string;
  autoRenew?: boolean;
};

export type TSubscriptionPlan = {
  code: string;
  priceKopecks: number;
  durationDays: number;
};

export type TSubscription = {
  status: string;
  plan: string;
  isPro: boolean;
  trialEndsAt?: string;
  currentPeriodEndAt?: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  recurringAvailable?: boolean;
  masterBotUsername?: string;
  plans: TSubscriptionPlan[];
};

export type TPromoValidation = {
  valid: boolean;
  discountType?: string;
  discountValue?: number;
  finalKopecks?: number;
  discountKopecks?: number;
  reason?: string;
};

export type TReferralClient = {
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
  firstPaymentAt?: string;
  isActive: boolean;
};

export type TReferralsResponse = {
  code: string;
  link: string;
  count: number;
  referrals: TReferralClient[];
  specialistCount: number;
  activeCount: number;
  passiveCount: number;
  specialists: TReferredSpecialist[];
  rewardDays?: number;
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

export type TScheduleContext = {
  workingHours: TWorkingHours[];
  daysOff: { date: string }[];
};

export type TAdminScheduleContext = {
  workingHours: TWorkingHours[];
  daysOff: TDayOff[];
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
