import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import ReferralsPage from '../page';

import type { TReferralsResponse } from '@/lib/types';

const useAdminReferralsMock = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useAdminReferrals: () => useAdminReferralsMock(),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('@/lib/telegram', () => ({
  getTelegramWebApp: () => null,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const messages = {
  AdminReferrals: {
    title: 'Приглашения',
    heroHeading: 'Пригласите коллег',
    heroBody: 'Альфа-этап — активируется после первой оплаты.',
    yourLink: 'Ваша ссылка',
    copyLink: 'Скопировать',
    linkCopied: 'Ок',
    copyFailed: 'Ошибка',
    shareTelegram: 'Поделиться',
    shareText: 'Попробуй 👉 {link}',
    statsActive: 'Активные',
    statsPending: 'Ожидают',
    sectionActive: 'Активные',
    sectionPending: 'Ожидают',
    listEmpty: 'Никого нет',
    joinedOn: 'Присоединился {date}',
    activatedOn: 'Оплатил {date}',
    statsCount: 'Приглашено',
    referralsTitle: 'Специалисты',
    referralsEmpty: 'Никого нет',
    blocked: 'Заблокирован',
  },
};

function renderWith(data: TReferralsResponse | null, isLoading = false): void {
  useAdminReferralsMock.mockReturnValue({
    data,
    isLoading,
    error: undefined,
    mutate: vi.fn(),
  });
  render(
    <NextIntlClientProvider locale={'ru'} messages={messages}>
      <ReferralsPage />
    </NextIntlClientProvider>,
  );
}

function makeResponse(overrides: Partial<TReferralsResponse> = {}): TReferralsResponse {
  return {
    code: 'abc',
    link: 'https://t.me/masterbot?start=ref_abc',
    count: 0,
    referrals: [],
    specialistCount: 0,
    activeCount: 0,
    passiveCount: 0,
    specialists: [],
    ...overrides,
  };
}

describe('ReferralsPage', () => {
  it('renders both sections when active and pending specialists exist', () => {
    renderWith(
      makeResponse({
        activeCount: 1,
        passiveCount: 1,
        specialistCount: 2,
        specialists: [
          {
            id: 'a',
            name: 'Paid Anna',
            botUsername: 'anna_bot',
            createdAt: '2026-03-01T00:00:00Z',
            firstPaymentAt: '2026-04-10T00:00:00Z',
            isActive: true,
          },
          {
            id: 'b',
            name: 'Pending Boris',
            botUsername: 'boris_bot',
            createdAt: '2026-04-15T00:00:00Z',
            isActive: false,
          },
        ],
      }),
    );

    expect(screen.getByText('Paid Anna')).toBeTruthy();
    expect(screen.getByText('Pending Boris')).toBeTruthy();
    expect(screen.getAllByText('Активные').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ожидают').length).toBeGreaterThan(0);
    expect(screen.queryByText('Никого нет')).toBeNull();
  });

  it('renders only pending section when no active referrals', () => {
    renderWith(
      makeResponse({
        passiveCount: 1,
        specialistCount: 1,
        specialists: [
          {
            id: 'b',
            name: 'Pending Boris',
            botUsername: 'boris_bot',
            createdAt: '2026-04-15T00:00:00Z',
            isActive: false,
          },
        ],
      }),
    );

    expect(screen.getByText('Pending Boris')).toBeTruthy();
    expect(screen.queryByText('Никого нет')).toBeNull();
  });

  it('shows empty state when no specialists at all', () => {
    renderWith(makeResponse());
    expect(screen.getByText('Никого нет')).toBeTruthy();
  });
});
