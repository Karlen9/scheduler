import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openTelegramUserChat } from '@/lib/telegram';

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

vi.mock('@/components/Switch', () => ({
  Switch: ({
    checked,
    onChange,
    ariaLabel,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    ariaLabel?: string;
  }): React.ReactNode => (
    <button
      type={'button'}
      role={'switch'}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
    />
  ),
}));

vi.mock('@/lib/telegram', () => ({
  getTelegramWebApp: () => null,
  openTelegramUserChat: vi.fn(),
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
    autoRenewToggleLabel: 'Автопродление',
    autoRenewToggleHint: 'Сохранить карту и продлевать подписку автоматически',
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
    benefitsHeading: 'Возможности Pro',
    benefitSelfBooking: 'Самостоятельная запись клиентов',
    benefitSelfBookingHint: 'Клиенты бронируют время сами по вашей ссылке',
    benefitRecurring: 'Повторяющиеся записи и абонементы',
    benefitRecurringHint: 'Регулярные сеансы и массовое планирование',
    benefitBulkDaysOff: 'Выходные периодами',
    benefitBulkDaysOffHint: 'Отмечайте нерабочие дни сразу диапазоном',
    benefitAnalytics: 'Расширенная аналитика',
    benefitAnalyticsHint: 'Подробная статистика и экспорт данных',
    manageInBotTitle: 'Управление подпиской в боте',
    manageInBotHint: 'Оплата и продление — в мастер-боте',
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
  // Plan selection, checkout, and promo-code UI were removed from this page in favor of a
  // "manage in bot" deep link (commit 0eca279); the page now only shows status + a static
  // benefits list, so these tests cover that instead of the old in-app plan picker.
  it('renders the Pro benefits list', () => {
    renderPage(makeSubscription());

    expect(screen.getByText('Возможности Pro')).toBeTruthy();
    expect(screen.getByText('Самостоятельная запись клиентов')).toBeTruthy();
    expect(screen.getByText('Повторяющиеся записи и абонементы')).toBeTruthy();
    expect(screen.getByText('Выходные периодами')).toBeTruthy();
    expect(screen.getByText('Расширенная аналитика')).toBeTruthy();
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

// Plan selection, checkout, and promo-code flows moved out of the mini-app and into the
// master bot (commit 0eca279); the page now surfaces a single "manage in bot" deep link
// instead, covered below in place of the old in-app checkout-flow tests.
describe('SubscriptionPage manage in bot', () => {
  it('opens a chat with the master bot when the manage link is clicked', () => {
    renderPage(makeSubscription({ masterBotUsername: 'masterbot' }));

    fireEvent.click(screen.getByText('Управление подпиской в боте'));

    expect(openTelegramUserChat).toHaveBeenCalledWith('masterbot');
  });

  it('hides the manage link when no masterBotUsername is present', () => {
    renderPage(makeSubscription({ masterBotUsername: undefined }));

    expect(screen.queryByText('Управление подпиской в боте')).toBeNull();
  });
});

describe('SubscriptionPage cancel / resume auto-renew', () => {
  it('shows the auto-renew toggle on when status=active without cancelAtPeriodEnd', () => {
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
    const toggle = screen.getByRole('switch', { name: 'Автопродление' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls cancelSubscription when the auto-renew toggle is switched off', async () => {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    renderPage(
      makeSubscription({
        status: 'active',
        isPro: true,
        currentPeriodEndAt: periodEnd,
        cancelAtPeriodEnd: false,
      }),
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Автопродление' }));

    await waitFor(() => {
      expect(apiMock.admin.cancelSubscription).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the auto-renew toggle off and calls resumeSubscription when cancelAtPeriodEnd=true', async () => {
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
    const toggle = screen.getByRole('switch', { name: 'Автопродление' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(apiMock.admin.resumeSubscription).toHaveBeenCalledTimes(1);
    });
  });
});
