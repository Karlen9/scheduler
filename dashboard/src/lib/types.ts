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

export type OwnerNamedValue = {
  name: string;
  value: number;
};

export type OwnerRevenueLeader = {
  name: string;
  botUsername?: string;
  currency: string;
  revenue: number;
};

export type OwnerActivityEvent = {
  id: string;
  type: string;
  title: string;
  detail?: string;
  entityId?: string;
  entityType?: string;
  status?: string;
  specialistId?: string;
  specialistName?: string;
  botUsername?: string;
  occurredAt: string;
};

export type OwnerBookingFunnel = {
  created: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  rejected: number;
  reschedulePending: number;
  cancelRequested: number;
  completionRate: number;
  dropoffRate: number;
};

export type OwnerCapacityStats = {
  windowStart: string;
  windowEnd: string;
  workingMinutes: number;
  bookedMinutes: number;
  bookedSlots: number;
  utilizationRate: number;
  specialistsWithoutWorkingHours: number;
  busiestWeekdays: OwnerNamedValue[];
  busiestHours: OwnerNamedValue[];
};

export type OwnerCancellationStats = {
  cancelled: number;
  rejected: number;
  clientCancelled: number;
  specialistCancelled: number;
  cancellationRate: number;
  bySpecialist: OwnerNamedValue[];
  byService: OwnerNamedValue[];
};

export type OwnerRetentionStats = {
  totalClients: number;
  repeatClients: number;
  oneTimeClients: number;
  newClients30d: number;
  activeClients30d: number;
  returningActive30d: number;
  returningRate: number;
};

export type OwnerNotificationHealth = {
  remindersSent: number;
  remindersPending: number;
  specialistBookingMessagesLinked: number;
  clientBookingMessagesLinked: number;
  specialistOptOutNewBookings: number;
  specialistOptOutCancellations: number;
  clientOptOutStatus: number;
  clientOptOutReminders: number;
};

export type DashboardOverview = {
  platform: OwnerPlatformStats;
  bookings: OwnerBookingStats;
  clients: OwnerClientStats;
  recurring: OwnerRecurringStats;
  referrals: OwnerReferralStats;
  bookingFunnel: OwnerBookingFunnel;
  capacity: OwnerCapacityStats;
  cancellations: OwnerCancellationStats;
  retention: OwnerRetentionStats;
  notificationHealth: OwnerNotificationHealth;
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
  revenueBySpecialist: OwnerRevenueLeader[];
  revenueByService: OwnerRevenueLeader[];
  activity: OwnerActivityEvent[];
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

export type DashboardSearchClient = {
  id: string;
  specialistId: string;
  specialistName: string;
  name: string;
  displayName?: string;
  telegramUserId: number;
  telegramUsername?: string;
  isGhost: boolean;
  isBlocked: boolean;
  createdAt: string;
};

export type DashboardSearchBooking = {
  id: string;
  specialistId: string;
  specialistName: string;
  clientName: string;
  serviceName?: string;
  status: string;
  startsAt: string;
};

export type DashboardSearchResponse = {
  specialists: DashboardSpecialist[];
  clients: DashboardSearchClient[];
  bookings: DashboardSearchBooking[];
};

export type DashboardCalendarEvent = {
  bookingId: string;
  specialistId: string;
  specialistName: string;
  botUsername?: string;
  clientName: string;
  serviceName?: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

export type DashboardConflictReport = {
  overlappingBookings: Array<{
    specialistId: string;
    specialistName: string;
    firstBookingId: string;
    secondBookingId: string;
    firstClient: string;
    secondClient: string;
    startsAt: string;
    endsAt: string;
  }>;
  invalidWorkingHours: Array<{
    specialistId: string;
    specialistName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    reason: string;
  }>;
};

export type DashboardAuditLogItem = {
  id: string;
  actorTelegramId: number;
  method: string;
  path: string;
  action: string;
  specialistId?: string;
  specialistName?: string;
  statusCode: number;
  createdAt: string;
};

export type DashboardSystemStatus = {
  backendOk: boolean;
  databaseOk: boolean;
  superadminEnabled: boolean;
  telegramAuthConfigured: boolean;
  adminCount: number;
  serverTime: string;
};

export type DashboardAdminsResponse = {
  adminIds: number[];
  count: number;
};
