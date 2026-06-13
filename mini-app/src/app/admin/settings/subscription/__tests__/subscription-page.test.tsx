import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SubscriptionPage from '../page';

import type { TSubscription } from '@/lib/types';

// ── dependency mocks ──────────────────────────────────────────────────────────

const useSubscriptionMock = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useSubscription: () => useSubscriptionMock(),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    onConfirm,
    onClose,
    title,
    confirmText,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onClose: () => void;
    title: string;
    confirmText: string;
  }): React.ReactNode =>
    isOpen ? (
      <div>
        <div>{title}</div>
        <button type={'button'} onClick={onConfirm}>
          {confirmText}
        </button>
        <button type={'button'} onClick={onClose}>
          {'close-dialog'}
        </button>
      </div>
    ) : null,
}));

vi.mock('@/lib/telegram', () => ({
  getTelegramWebApp: () => null,
}));

vi.mock('swr', () => ({
  default: {},
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const apiMock = {
  admin: {
    checkoutSubscription: vi.fn(),
    validatePromo: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
  },
};

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      checkoutSubscription: (...args: unknown[]) => apiMock.admin.checkoutSubscription(...args),
      validatePromo: (...args: unknown[]) => apiMock.admin.validatePromo(...args),
      cancelSubscription: (...args: unknown[]) => apiMock.admin.cancelSubscription(...args),
      resumeSubscription: (...args: unknown[]) => apiMock.admin.resumeSubscription(...args),
    },
  },
}));

// ── i18n messages ─────────────────────────────────────────────────────────────

const messages = {
  Subscription: {
    title: 'Подписка Pro',
    statusTrial: 'Пробный период',
    statusTrialDaysLeft: 'Осталось {days} дн.',
    statusActive: 'Активна',
    statusActiveUntil: 'До {date}',
    statusCancelled: 'Отменена',
    statusCancelledUntil: 'Доступ до {date}, продление отключено',
    statusExpired: 'Истекла',
    statusFree: 'Бесплатный план',
    plansHeading: 'Выберите план',
    planRecommended: 'Выгоднее',
    planPerMonth: '/ мес',
    planPerQuarter: '/ квартал',
    planPerYear: '/ год',
    planPerHalfYear: '/ 6 мес',
    planMonthly: 'Месяц',
    planQuarterly: '3 месяца',
    planAnnual: 'Год',
    planHalfYear: '6 месяцев',
    priceLabel: '{price} ₽',
    checkoutButton: 'Оформить',
    checkoutProcessing: 'Обработка…',
    checkoutSuccess: 'Подписка активирована',
    checkoutError: 'Не удалось оформить подписку',
    promoInputPlaceholder: 'Промокод',
    promoApply: 'Применить',
    promoApplied: 'Промокод применён — скидка {discount} ₽',
    promoInvalid: 'Промокод недействителен',
    promoChecking: 'Проверка…',
    autoRenewOn: 'Автопродление включено',
    autoRenewOff: 'Автопродление отключено',
    cancelAutoRenew: 'Отключить автопродление',
    resumeAutoRenew: 'Включить автопродление',
    cancelConfirmTitle: 'Отключить автопродление?',
    cancelConfirmBody: 'Вы сохраните доступ до конца периода, после чего подписка не продлится.',
    cancelConfirmButton: 'Отключить',
    cancelSuccess: 'Автопродление отключено',
    resumeSuccess: 'Автопродление включено',
    actionError: 'Не удалось выполнить действие',
    bookingUnavailableTitle: 'Запись временно недоступна',
    bookingUnavailableDescription:
      'Онлайн-запись пока недоступна. Свяжитесь со специалистом напрямую.',
  },
};

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeSubscription(overrides: Partial<TSubscription> = {}): TSubscription {
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    status: 'trialing',
    plan: '',
    isPro: true,
    trialEndsAt,
    autoRenew: false,
    cancelAtPeriodEnd: false,
    plans: [
      { code: 'pro_monthly', priceKopecks: 59000, durationDays: 30 },
      { code: 'pro_quarterly', priceKopecks: 149000, durationDays: 90 },
      { code: 'pro_annual', priceKopecks: 499000, durationDays: 365 },
    ],
    ...overrides,
  };
}

function renderPage(sub: TSubscription | null, isLoading = false): void {
  useSubscriptionMock.mockReturnValue({
    data: sub,
    isLoading,
    mutate: vi.fn(),
  });
  render(
    <NextIntlClientProvider locale={'ru'} messages={messages}>
      <SubscriptionPage />
    </NextIntlClientProvider>,
  );
}

// ── tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Prevent happy-dom from actually navigating to mock URLs.
  vi.spyOn(window, 'open').mockImplementation(() => null);
  apiMock.admin.checkoutSubscription.mockResolvedValue({ confirmationUrl: 'https://pay.mock/1' });
  apiMock.admin.validatePromo.mockResolvedValue({ valid: false });
  apiMock.admin.cancelSubscription.mockResolvedValue(
    makeSubscription({ cancelAtPeriodEnd: true, autoRenew: false }),
  );
  apiMock.admin.resumeSubscription.mockResolvedValue(
    makeSubscription({ cancelAtPeriodEnd: false, autoRenew: true }),
  );
});

describe('SubscriptionPage plan rendering', () => {
  it('renders all three plan labels', () => {
    renderPage(makeSubscription());

    expect(screen.getByText('Месяц')).toBeTruthy();
    expect(screen.getByText('3 месяца')).toBeTruthy();
    expect(screen.getByText('Год')).toBeTruthy();
  });

  it('renders correct prices in roubles (kopecks / 100)', () => {
    renderPage(makeSubscription());

    // Each plan row shows "<price> ₽ / <suffix>"
    expect(screen.getByText(/590/)).toBeTruthy();
    expect(screen.getByText(/1490/)).toBeTruthy();
    expect(screen.getByText(/4990/)).toBeTruthy();
  });

  it('marks the annual plan as recommended', () => {
    renderPage(makeSubscription());

    expect(screen.getByText('Выгоднее')).toBeTruthy();
  });

  it('shows the trial status when status=trialing', () => {
    renderPage(makeSubscription({ status: 'trialing' }));

    expect(screen.getByText('Пробный период')).toBeTruthy();
  });

  it('shows free plan status when no subscription data', () => {
    renderPage(
      makeSubscription({
        status: 'free',
        isPro: false,
        trialEndsAt: undefined,
        currentPeriodEndAt: undefined,
      }),
    );

    expect(screen.getByText('Бесплатный план')).toBeTruthy();
  });

  it('shows expired status', () => {
    renderPage(makeSubscription({ status: 'expired', isPro: false, trialEndsAt: undefined }));

    expect(screen.getByText('Истекла')).toBeTruthy();
  });
});

describe('SubscriptionPage checkout flow', () => {
  it('calls checkoutSubscription with the selected plan on button click', async () => {
    renderPage(makeSubscription());

    fireEvent.click(screen.getByRole('button', { name: 'Оформить' }));

    await waitFor(() => {
      expect(apiMock.admin.checkoutSubscription).toHaveBeenCalledWith('pro_annual', undefined);
    });
  });

  it('calls checkoutSubscription with promo code when one is applied', async () => {
    apiMock.admin.validatePromo.mockResolvedValue({
      valid: true,
      discountKopecks: 499000,
      finalKopecks: 0,
      discountValue: 100,
    });

    renderPage(makeSubscription());

    const input = screen.getByPlaceholderText('Промокод');
    fireEvent.change(input, { target: { value: 'MOCK100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));

    await waitFor(() => {
      expect(apiMock.admin.validatePromo).toHaveBeenCalledWith('MOCK100', 'pro_annual');
    });

    apiMock.admin.checkoutSubscription.mockResolvedValue({ granted: true });
    fireEvent.click(screen.getByRole('button', { name: 'Оформить' }));

    await waitFor(() => {
      expect(apiMock.admin.checkoutSubscription).toHaveBeenCalledWith('pro_annual', 'MOCK100');
    });
  });
});

describe('SubscriptionPage cancel / resume auto-renew', () => {
  it('shows cancel button and confirm dialog when status=active without cancelAtPeriodEnd', async () => {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    renderPage(
      makeSubscription({
        status: 'active',
        isPro: true,
        currentPeriodEndAt: periodEnd,
        cancelAtPeriodEnd: false,
      }),
    );

    expect(screen.getByText('Автопродление включено')).toBeTruthy();
    const cancelBtn = screen.getByRole('button', { name: 'Отключить автопродление' });
    expect(cancelBtn).toBeTruthy();

    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.getByText('Отключить автопродление?')).toBeTruthy();
    });
  });

  it('calls cancelSubscription when confirm dialog is confirmed', async () => {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    renderPage(
      makeSubscription({
        status: 'active',
        isPro: true,
        currentPeriodEndAt: periodEnd,
        cancelAtPeriodEnd: false,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Отключить автопродление' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Отключить' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));

    await waitFor(() => {
      expect(apiMock.admin.cancelSubscription).toHaveBeenCalledTimes(1);
    });
  });

  it('shows resume button and calls resumeSubscription when cancelAtPeriodEnd=true', async () => {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    renderPage(
      makeSubscription({
        status: 'active',
        isPro: true,
        currentPeriodEndAt: periodEnd,
        cancelAtPeriodEnd: true,
        autoRenew: false,
      }),
    );

    expect(screen.getByText('Автопродление отключено')).toBeTruthy();
    const resumeBtn = screen.getByRole('button', { name: 'Включить автопродление' });
    expect(resumeBtn).toBeTruthy();

    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(apiMock.admin.resumeSubscription).toHaveBeenCalledTimes(1);
    });
  });
});
