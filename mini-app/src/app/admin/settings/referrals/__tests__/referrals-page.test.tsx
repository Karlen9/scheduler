import { fireEvent, render, screen } from '@testing-library/react';
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
    heroBody: 'Приглашённые коллеги появятся в этом списке.',
    yourLink: 'Ваша ссылка',
    copyLink: 'Скопировать',
    linkCopied: 'Ок',
    copyFailed: 'Ошибка',
    shareTelegram: 'Поделиться',
    shareText: 'Попробуй 👉',
    statsInvited: 'Приглашённые',
    sectionInvited: 'Приглашённые',
    listEmpty: 'Никого нет',
    joinedOn: 'Присоединился {date}',
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
    specialists: [],
    ...overrides,
  };
}

describe('ReferralsPage', () => {
  it('lists invited specialists, newest first', () => {
    renderWith(
      makeResponse({
        specialistCount: 2,
        specialists: [
          {
            id: 'a',
            name: 'Anna',
            botUsername: 'anna_bot',
            createdAt: '2026-03-01T00:00:00Z',
          },
          {
            id: 'b',
            name: 'Boris',
            botUsername: 'boris_bot',
            createdAt: '2026-04-15T00:00:00Z',
          },
        ],
      }),
    );

    const names = screen.getAllByText(/^(Anna|Boris)$/).map((el) => el.textContent);
    expect(names).toEqual(['Boris', 'Anna']);
    expect(screen.getAllByText('Приглашённые').length).toBeGreaterThan(0);
    expect(screen.queryByText('Никого нет')).toBeNull();
  });

  it('shows empty state when no specialists at all', () => {
    renderWith(makeResponse());
    expect(screen.getByText('Никого нет')).toBeTruthy();
  });

  it('shares referral link once without plus-encoded text', () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    const link = 'https://t.me/masterbot?start=ref_abc';

    renderWith(makeResponse({ link }));
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));

    expect(openMock).toHaveBeenCalledTimes(1);
    const shareUrl = String(openMock.mock.calls[0][0]);
    expect(shareUrl).not.toContain('+');

    const parsed = new URL(shareUrl);
    expect(parsed.searchParams.get('url')).toBe(link);
    expect(parsed.searchParams.get('text')).toBe('Попробуй 👉');
    expect(parsed.searchParams.get('text')).not.toContain(link);

    openMock.mockRestore();
  });
});
