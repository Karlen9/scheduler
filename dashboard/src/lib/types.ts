export type DashboardUser = {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  authDate: number;
};

export type OwnerPlatformStats = {
  totalSpecialists: number;
  activeSpecialists: number;
  deletedSpecialists: number;
  newSpecialists7d: number;
  newSpecialists30d: number;
  recentlyActive7d: number;
  recentlyActive30d: number;
  configuredWithPhoto: number;
  withCustomBio: number;
  withReferralCode: number;
};

export type OwnerBookingStats = {
  total: number;
  last7d: number;
  last30d: number;
  statusPending: number;
  statusConfirmed: number;
  statusCompleted: number;
  statusCancelled: number;
  statusRejected: number;
  statusReschedule: number;
  cancellationRate: number;
  reschedules: number;
  avgPerSpecialist: number;
};

export type OwnerClientStats = {
  total: number;
  ghosts: number;
  real: number;
  blocked: number;
  new7d: number;
  new30d: number;
  avgPerSpec: number;
  viaReferral: number;
};

export type OwnerRecurringStats = {
  total: number;
  active: number;
  pending: number;
  cancelled: number;
  declined: number;
};

export type OwnerReferralStats = {
  referredClients: number;
  specialistsWithCode: number;
  topReferrers: Array<{
    specialistName: string;
    botUsername: string;
    referredCount: number;
  }>;
};

export type DashboardOverview = {
  platform: OwnerPlatformStats;
  bookings: OwnerBookingStats;
  clients: OwnerClientStats;
  recurring: OwnerRecurringStats;
  referrals: OwnerReferralStats;
  topSpecialistsByBookings: Array<{
    name: string;
    botUsername: string;
    value: number;
  }>;
  topSpecialistsByClients: Array<{
    name: string;
    botUsername: string;
    value: number;
  }>;
  durationBreakdown: Array<{ durationMinutes: number; count: number }>;
  monthlyTrends: Array<{
    month: string;
    bookings: number;
    completed: number;
    cancelled: number;
    newClients: number;
    newSpecialists: number;
  }>;
  revenueByCurrency: Array<{ currency: string; revenue: number }>;
};

export type DashboardSpecialist = {
  id: string;
  telegramUserId: number;
  name: string;
  botUsername: string;
  timezone: string;
  telegramHandle?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  deletedAt?: string;
  firstPaymentAt?: string;
  bookingCount: number;
  clientCount: number;
};

export type SpecialistListResponse = {
  specialists: DashboardSpecialist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchQuery?: string;
  status?: string;
};

export type SpecialistProfile = {
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
  language?: string;
  wallpaper?: string;
};

export type SessionType = {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  imageUrl?: string;
  sessionsCount?: number;
};

export type Client = {
  id: string;
  telegramUserId: number;
  telegramUsername?: string;
  specialistId: string;
  name: string;
  displayName?: string;
  phone?: string;
  photoUrl?: string;
  isGhost?: boolean;
  isBlocked?: boolean;
  createdAt: string;
};

export type Booking = {
  id: string;
  clientId?: string;
  clientBatchId?: string;
  sessionType?: SessionType;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  clientMessage?: string;
  status:
    | "pending"
    | "confirmed"
    | "rejected"
    | "cancelled"
    | "completed"
    | "cancel_requested"
    | "reschedule_pending";
  cancelReason?: string;
  cancelledBy?: "client" | "specialist";
  durationMinutes?: number;
  createdBy?: "client" | "specialist";
  createdAt?: string;
  recurringScheduleId?: string;
  clientIsGhost?: boolean;
  clientTelegramUserId?: number;
  clientTelegramUsername?: string;
};

export type BookingListResponse = {
  bookings: Booking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ClientListResponse = {
  clients: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchQuery?: string;
};

export type WorkingHours = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type DayOff = {
  id: string;
  date: string;
  reason?: string;
  createdAt: string;
};

export type RecurringSchedule = {
  id: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  dayOfWeek: number;
  time: string;
  durationMinutes: number;
  status: "pending" | "active" | "declined" | "cancelled";
  createdBy: "client" | "specialist";
  createdAt: string;
  sessionTypeId?: string;
  sessionType?: SessionType;
  daysOfWeek?: string;
  startDate?: string;
  endDate?: string;
  dayTimes?: string;
  bookings?: Booking[];
};

export type AdminStats = {
  totalBookings: number;
  activeClients: number;
  completionRate: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  totalClients: number;
  newClientsThisMonth: number;
  returningRate: number;
  avgBookingsPerWeek: number;
  cancellationRate: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueCurrency: string;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  revenueByService: Array<{ name: string; revenue: number }>;
  topClients: Array<{ name: string; count: number; photoUrl?: string }>;
};

export type ReferralsResponse = {
  code: string;
  link: string;
  count: number;
  referrals: Array<{
    id: string;
    name: string;
    displayName?: string;
    photoUrl?: string;
    createdAt: string;
    telegramUserId?: number;
    isBlocked?: boolean;
  }>;
  specialistCount: number;
  activeCount: number;
  passiveCount: number;
  specialists: Array<{
    id: string;
    name: string;
    botUsername: string;
    createdAt: string;
    firstPaymentAt?: string;
    isActive: boolean;
  }>;
};

export type SpecialistSnapshot = {
  profile: SpecialistProfile;
  stats: AdminStats;
  services: SessionType[];
  bookings: BookingListResponse;
  clients: ClientListResponse;
  recurring: RecurringSchedule[];
  schedule: {
    workingHours: WorkingHours[];
    daysOff: DayOff[];
  };
  notifications: {
    notifyNewBookings: boolean;
    notifyCancellations: boolean;
  };
  referrals: ReferralsResponse;
  durations: number[];
};
