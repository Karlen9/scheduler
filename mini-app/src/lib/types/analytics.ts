type TTimeSlotLabel = 'morning' | 'afternoon' | 'evening';

type TDurationBreakdown = {
  duration: number;
  count: number;
};

type TMonthlyTrendPoint = {
  month: string;
  count: number;
};

type TRevenueByMonthPoint = {
  month: string;
  revenue: number;
};

type TRevenueByService = {
  name: string;
  revenue: number;
};

type TTopClientStat = {
  name: string;
  count: number;
  photoUrl?: string;
};

export type TClientStats = {
  totalSessions: number;
  totalHours: number;
  completionRate: number;
  sessionsThisMonth: number;
  sessionsLastMonth: number;
  currentStreak: number;
  longestStreak: number;
  mostCommonDay: number | null;
  mostCommonTimeSlot: TTimeSlotLabel | null;
  averageDuration: number;
  durationBreakdown: TDurationBreakdown[];
  monthlyTrend: TMonthlyTrendPoint[];
};

export type TAdminStats = {
  totalBookings: number;
  activeClients: number;
  completionRate: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  totalClients: number;
  newClientsThisMonth: number;
  topClients: TTopClientStat[];
  returningRate: number;
  busiestDay: number | null;
  busiestTimeSlot: TTimeSlotLabel | null;
  avgBookingsPerWeek: number;
  cancellationRate: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueCurrency: string;
  revenueByMonth: TRevenueByMonthPoint[];
  revenueByService: TRevenueByService[];
};
