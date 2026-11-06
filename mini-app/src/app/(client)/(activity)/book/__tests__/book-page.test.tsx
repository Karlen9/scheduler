import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import BookingPage from '../page';

// ── dependency mocks ──────────────────────────────────────────────────────────

// Mock all the hooks the page and BookingForm use.
const useScheduleContextMock = vi.fn();
const useSessionTypesMock = vi.fn();
const useClientBatchesMock = vi.fn();
const useBookingsMock = vi.fn();

vi.mock('@/hooks/queries', () => ({
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
  BookingForm: { title: 'Онлайн запись' },
  PreviewMode: { readOnlyAction: 'Только просмотр' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function setupDefaultHooks(): void {
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

describe('BookingPage', () => {
  it('renders the booking form', () => {
    setupDefaultHooks();
    renderPage();

    expect(screen.getByTestId('booking-form')).toBeTruthy();
  });
});
