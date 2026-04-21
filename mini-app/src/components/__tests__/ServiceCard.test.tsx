import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '@/__tests__/mocks';
import ServicesPage from '@/app/(client)/services/page';
import { ServiceCard } from '@/components/ServiceCard';
import { useClientBatches, useSessionTypes } from '@/hooks/queries';

import type { TClientBatch, TSessionType } from '@/lib/types';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/services',
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/hooks/queries', () => ({
  useClientBatches: vi.fn(),
  useSessionTypes: vi.fn(),
}));

function makeBatchService(overrides: Partial<TSessionType> = {}): TSessionType {
  return {
    id: 'batch-service',
    type: 'batch',
    name: 'Абонемент',
    durationMinutes: 60,
    price: 10000,
    currency: 'RUB',
    sessionsCount: 10,
    ...overrides,
  };
}

function makeBatch(overrides: Partial<TClientBatch> = {}): TClientBatch {
  return {
    id: 'batch-1',
    clientId: 'client-1',
    serviceId: 'batch-service',
    totalSessions: 10,
    remainingSessions: 7,
    createdAt: '2026-04-21T10:00:00Z',
    status: 'active',
    ...overrides,
  };
}

describe('ServiceCard batch states', () => {
  it('renders a batch without an assigned batch', () => {
    renderWithIntl(<ServiceCard service={makeBatchService()} />);

    expect(screen.getByText(/10 занятий · 10\s000 ₽ · 1\s000 ₽\/занятие/)).toBeInTheDocument();
    expect(screen.queryByText(/Осталось/)).not.toBeInTheDocument();
  });

  it('renders an active batch remaining badge', () => {
    renderWithIntl(<ServiceCard service={makeBatchService()} clientBatch={makeBatch()} />);

    expect(screen.getByText('Осталось: 7/10')).toBeInTheDocument();
  });

  it('renders an exhausted batch state', () => {
    renderWithIntl(
      <ServiceCard
        service={makeBatchService()}
        clientBatch={makeBatch({ remainingSessions: 0, status: 'exhausted' })}
      />,
    );

    expect(screen.getByText('Абонемент закончился')).toBeInTheDocument();
  });
});

describe('ServicesPage no-batch modal', () => {
  it('opens the no-batch modal when tapping a batch service without active sessions', async () => {
    vi.mocked(useSessionTypes).mockReturnValue({
      data: [makeBatchService()],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    vi.mocked(useClientBatches).mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    renderWithIntl(<ServicesPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Записаться на услугу' }));

    expect(screen.getByText('Абонемент не оформлен')).toBeInTheDocument();
    expect(
      screen.getByText('У вас пока нет абонемента. Обратитесь к специалисту, чтобы оформить.'),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
