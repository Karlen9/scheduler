import { isoAt } from './utils';

import type { TAdminStats, TClientStats, TReferralsResponse } from '../types';
import type { TMockState } from './types';

const MONTH_LABELS = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

function recentMonthLabels(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return MONTH_LABELS[date.getMonth()];
  });
}

export function buildAdminStats(state: TMockState): TAdminStats {
  const labels = recentMonthLabels(8);
  const revenue = [88000, 97500, 109000, 102500, 118000, 127500, 121500, 137000];
  const byService = [49500, 28000, 19500, 33000, 7000];
  const topClients = [
    { key: 'mock-client-katya', count: 24 },
    { key: 'mock-client-natalia', count: 21 },
    { key: 'mock-client-anna', count: 19 },
    { key: 'mock-client-dasha', count: 17 },
    { key: 'mock-profile', count: 15 },
  ];

  return {
    totalBookings: 168,
    activeClients: 12,
    completionRate: 92,
    bookingsThisMonth: 41,
    bookingsLastMonth: 37,
    totalClients: state.clients.length,
    newClientsThisMonth: 4,
    topClients: topClients.flatMap(({ count, key }) => {
      const client = state.clients.find((item) => item.id === key);
      return client
        ? [{ name: client.displayName || client.name, count, photoUrl: client.photoUrl }]
        : [];
    }),
    returningRate: 78,
    busiestDay: 3,
    busiestTimeSlot: 'afternoon',
    avgBookingsPerWeek: 10.5,
    cancellationRate: 6,
    revenueThisMonth: revenue[revenue.length - 1],
    revenueLastMonth: revenue[revenue.length - 2],
    revenueCurrency: 'RUB',
    revenueByMonth: labels.map((month, index) => ({ month, revenue: revenue[index] })),
    revenueByService: state.services.map((service, index) => ({
      name: service.name,
      revenue: byService[index] ?? 0,
    })),
  };
}

export function buildClientStats(): TClientStats {
  const labels = recentMonthLabels(6);
  const counts = [2, 3, 2, 4, 4, 3];

  return {
    totalSessions: 17,
    totalHours: 16.5,
    completionRate: 94,
    sessionsThisMonth: 3,
    sessionsLastMonth: 4,
    currentStreak: 6,
    longestStreak: 9,
    mostCommonDay: 2,
    mostCommonTimeSlot: 'afternoon',
    averageDuration: 58,
    durationBreakdown: [
      { duration: 30, count: 2 },
      { duration: 45, count: 3 },
      { duration: 60, count: 9 },
      { duration: 90, count: 3 },
    ],
    monthlyTrend: labels.map((month, index) => ({ month, count: counts[index] })),
  };
}

export function buildReferrals(state: TMockState): TReferralsResponse {
  const code = state.adminProfile.referralCode ?? 'a3f9c2e81b7d4f06';
  const referredKeys = [
    'mock-client-olga',
    'mock-client-mikhail',
    'mock-client-andrey',
    'mock-client-alina',
    'mock-client-katya',
  ];
  const referrals = referredKeys.flatMap((id) => {
    const client = state.clients.find((item) => item.id === id);
    return client
      ? [
          {
            id: client.id,
            name: client.name,
            displayName: client.displayName,
            photoUrl: client.photoUrl,
            createdAt: client.createdAt,
            telegramUserId: client.telegramUserId,
            isBlocked: client.isBlocked,
          },
        ]
      : [];
  });
  const specialists = [
    {
      id: 'mock-referred-specialist-1',
      name: 'Ирина Тихонова',
      botUsername: 'irina_beauty_bot',
      createdAt: isoAt(-21, '12:00'),
    },
    {
      id: 'mock-referred-specialist-2',
      name: 'Артём Громов',
      botUsername: 'artem_fit_bot',
      createdAt: isoAt(-9, '15:30'),
    },
  ];

  return {
    code,
    link: `https://t.me/${state.adminProfile.botUsername ?? 'schedu1erbot'}?start=ref_${code}`,
    count: referrals.length,
    referrals,
    specialistCount: specialists.length,
    specialists,
  };
}
