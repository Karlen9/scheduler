import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/__tests__/mocks';

import AdminAnalyticsPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const { useAdminStatsMock } = vi.hoisted(() => ({
  useAdminStatsMock: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminStats: () => useAdminStatsMock(),
}));

describe('AdminAnalyticsPage', () => {
  beforeEach(() => {
    useAdminStatsMock.mockReset();
  });

  it('renders admin analytics content', () => {
    useAdminStatsMock.mockReturnValue({
      data: {
        totalBookings: 48,
        activeClients: 11,
        completionRate: 82,
        bookingsThisMonth: 9,
        bookingsLastMonth: 7,
        totalClients: 18,
        newClientsThisMonth: 4,
        topClients: [
          { name: 'Анна', count: 6 },
          { name: 'Иван', count: 4 },
        ],
        returningRate: 61,
        busiestDay: 2,
        busiestTimeSlot: 'evening',
        avgBookingsPerWeek: 5.5,
        cancellationRate: 12,
        revenueThisMonth: 22000,
        revenueLastMonth: 18000,
        revenueCurrency: 'RUB',
        revenueByMonth: [
          { month: '2026-01', revenue: 5000 },
          { month: '2026-02', revenue: 7000 },
          { month: '2026-03', revenue: 9000 },
          { month: '2026-04', revenue: 12000 },
          { month: '2026-05', revenue: 15000 },
          { month: '2026-06', revenue: 22000 },
        ],
        revenueByService: [
          { name: 'Консультация', revenue: 12000 },
          { name: 'Терапия', revenue: 10000 },
        ],
      },
      isLoading: false,
      error: undefined,
    });

    renderWithIntl(<AdminAnalyticsPage />);

    expect(screen.getAllByText('Аналитика')[0]).toBeInTheDocument();
    expect(screen.getByText('Клиенты')).toBeInTheDocument();
    expect(screen.getByText('Топ клиенты')).toBeInTheDocument();
    expect(screen.getByText('Доход')).toBeInTheDocument();
    expect(screen.getByText('Анна')).toBeInTheDocument();
  });

  it('renders empty state without bookings', () => {
    useAdminStatsMock.mockReturnValue({
      data: {
        totalBookings: 0,
        activeClients: 0,
        completionRate: 0,
        bookingsThisMonth: 0,
        bookingsLastMonth: 0,
        totalClients: 0,
        newClientsThisMonth: 0,
        topClients: [],
        returningRate: 0,
        busiestDay: null,
        busiestTimeSlot: null,
        avgBookingsPerWeek: 0,
        cancellationRate: 0,
        revenueThisMonth: 0,
        revenueLastMonth: 0,
        revenueCurrency: '',
        revenueByMonth: [],
        revenueByService: [],
      },
      isLoading: false,
      error: undefined,
    });

    renderWithIntl(<AdminAnalyticsPage />);

    expect(screen.getByText('Недостаточно данных')).toBeInTheDocument();
    expect(screen.getByText('Статистика появится после первых записей')).toBeInTheDocument();
  });
});
