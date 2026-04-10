import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/__tests__/mocks';

import AnalyticsPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

const { useClientStatsMock } = vi.hoisted(() => ({
  useClientStatsMock: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useClientStats: () => useClientStatsMock(),
}));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    useClientStatsMock.mockReset();
  });

  it('renders analytics content', () => {
    useClientStatsMock.mockReturnValue({
      data: {
        totalSessions: 12,
        totalHours: 18.5,
        completionRate: 85,
        sessionsThisMonth: 3,
        sessionsLastMonth: 2,
        currentStreak: 3,
        longestStreak: 8,
        mostCommonDay: 1,
        mostCommonTimeSlot: 'morning',
        averageDuration: 75,
        durationBreakdown: [
          { duration: 60, count: 8 },
          { duration: 90, count: 4 },
        ],
        monthlyTrend: [
          { month: '2026-01', count: 1 },
          { month: '2026-02', count: 2 },
          { month: '2026-03', count: 3 },
          { month: '2026-04', count: 4 },
          { month: '2026-05', count: 1 },
          { month: '2026-06', count: 1 },
        ],
      },
      isLoading: false,
      error: undefined,
    });

    renderWithIntl(<AnalyticsPage />);

    expect(screen.getByText('Аналитика')).toBeInTheDocument();
    expect(screen.getByText('Всего сеансов')).toBeInTheDocument();
    expect(screen.getByText('18.5')).toBeInTheDocument();
    expect(screen.getByText('Паттерны')).toBeInTheDocument();
    expect(screen.getByText('Утро')).toBeInTheDocument();
    expect(screen.getByText('По длительности')).toBeInTheDocument();
  });

  it('renders empty state when there is no data', () => {
    useClientStatsMock.mockReturnValue({
      data: {
        totalSessions: 0,
        totalHours: 0,
        completionRate: 0,
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        currentStreak: 0,
        longestStreak: 0,
        mostCommonDay: null,
        mostCommonTimeSlot: null,
        averageDuration: 0,
        durationBreakdown: [],
        monthlyTrend: [],
      },
      isLoading: false,
      error: undefined,
    });

    renderWithIntl(<AnalyticsPage />);

    expect(screen.getByText('Недостаточно данных')).toBeInTheDocument();
    expect(screen.getByText('Запишитесь на сеанс, чтобы увидеть статистику')).toBeInTheDocument();
  });
});
