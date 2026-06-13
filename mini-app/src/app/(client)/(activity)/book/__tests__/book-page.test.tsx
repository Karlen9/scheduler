import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import BookingPage from '../page';

import type { TSpecialist } from '@/lib/types';

// ── dependency mocks ──────────────────────────────────────────────────────────

// Mock all the hooks the page and BookingForm use.
const useSpecialistMock = vi.fn();
const useScheduleContextMock = vi.fn();
const useSessionTypesMock = vi.fn();
const useClientBatchesMock = vi.fn();
const useBookingsMock = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useSpecialist: () => useSpecialistMock(),
  useScheduleContext: () => useScheduleContextMock(),
  useSessionTypes: () => useSessionTypesMock(),
  useClientBatches: () => useClientBatchesMock(),
  useBookings: () => useBookingsMock(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/book',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/telegram', () => ({
  getUserName: () => 'Test User',
}));

vi.mock('@/lib/routes', () => ({
  isPreviewRoute: () => false,
}));

// BookingForm is a complex component; stub it so we can confirm it renders (or doesn't).
vi.mock('@/components/BookingForm', () => ({
  BookingForm: (): React.ReactNode => <div data-testid={'booking-form'}>{'BookingForm'}</div>,
}));

// ── i18n ──────────────────────────────────────────────────────────────────────

const messages = {
  Common: { loading: 'Загрузка...' },
  Subscription: {
    bookingUnavailableTitle: 'Запись временно недоступна',
    bookingUnavailableDescription:
      'Онлайн-запись пока недоступна. Свяжитесь со специалистом напрямую.',
  },
  BookingForm: { title: 'Онлайн запись' },
  PreviewMode: { readOnlyAction: 'Только просмотр' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSpecialist(isPro: boolean): TSpecialist {
  return {
    id: 'mock-specialist',
    name: 'Test Specialist',
    timezone: 'Europe/Moscow',
    cancelCutoffHours: 12,
    isPro,
  };
}

function setupDefaultHooks(specialist: TSpecialist | null, specialistLoading = false): void {
  useSpecialistMock.mockReturnValue({ data: specialist, isLoading: specialistLoading });
  useScheduleContextMock.mockReturnValue({
    data: { workingHours: [], daysOff: [] },
    isLoading: false,
  });
  useSessionTypesMock.mockReturnValue({ data: [], isLoading: false });
  useClientBatchesMock.mockReturnValue({ data: [], isLoading: false });
  useBookingsMock.mockReturnValue({ data: [] });
}

function renderPage(): void {
  render(
    <NextIntlClientProvider locale={'ru'} messages={messages}>
      <BookingPage />
    </NextIntlClientProvider>,
  );
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('BookingPage Pro gate', () => {
  it('renders the booking form when specialist isPro=true', () => {
    setupDefaultHooks(makeSpecialist(true));
    renderPage();

    expect(screen.getByTestId('booking-form')).toBeTruthy();
    expect(screen.queryByText('Запись временно недоступна')).toBeNull();
  });

  it('renders the unavailable state and hides the form when specialist isPro=false', () => {
    setupDefaultHooks(makeSpecialist(false));
    renderPage();

    expect(screen.getByText('Запись временно недоступна')).toBeTruthy();
    expect(
      screen.getByText('Онлайн-запись пока недоступна. Свяжитесь со специалистом напрямую.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('booking-form')).toBeNull();
  });

  it('renders the booking form while specialist is still loading (does not pre-emptively gate)', () => {
    setupDefaultHooks(null, true);
    renderPage();

    // While loading, specialist is null and isLoading=true — the gate condition requires
    // !specialistLoading && specialist !== null && !specialist.isPro.
    // So the form should be rendered (not gated) during loading.
    expect(screen.getByTestId('booking-form')).toBeTruthy();
  });
});
