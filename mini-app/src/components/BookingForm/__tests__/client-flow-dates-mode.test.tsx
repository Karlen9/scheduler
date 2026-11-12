import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ru from '../../../../messages/ru.json';
import { BookingForm } from '../index';

import type { TBookingFormProps, TSessionType } from '@/lib/types';

const service = {
  id: 's1',
  name: 'Консультация',
  type: 'common',
  durationMinutes: 60,
  price: 3000,
  currency: 'RUB',
} as unknown as TSessionType;

const hookState = vi.hoisted(() => ({ mode: 'single' as 'single' | 'multi' }));

vi.mock('../useOnetimeBooking', () => ({
  useOnetimeBooking: () => ({
    mode: hookState.mode,
    setMode: vi.fn(),
    selectedService: service,
    selectedDate: null,
    selectedTime: null,
    selectedDates: [],
    activeDateISO: null,
    timeAssignments: {},
    timeSlots: [],
    disabledDates: [],
    isLoadingSlots: false,
    message: '',
    setMessage: vi.fn(),
    multiActiveTime: null,
    onetimeButtonText: 'Записаться',
    onetimeButtonDisabled: true,
    handleServiceSelect: vi.fn(),
    handleEditService: vi.fn(),
    isServiceSelectable: () => true,
    handleSingleDateSelect: vi.fn(),
    handleSingleTimeSelect: vi.fn(),
    handleMultiDateToggle: vi.fn(),
    handleChipTap: vi.fn(),
    handleMultiTimeSelect: vi.fn(),
    handleOnetimeSubmit: vi.fn(),
  }),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminClientBatches: () => ({ data: [], isLoading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/book',
  useSearchParams: () => new URLSearchParams(),
}));

const baseProps: TBookingFormProps = {
  services: [service],
  workingHours: [],
  daysOff: [],
  isLoading: false,
  showRecurring: false,
  onCreateBooking: async () => undefined,
  onCreateRecurring: async () => undefined,
  onPreviewRecurring: async () => Promise.resolve({ dates: [] }),
  successRedirect: '/bookings',
};

function renderForm(props: Partial<TBookingFormProps>): void {
  render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <BookingForm {...baseProps} {...props} />
    </NextIntlClientProvider>,
  );
}

function day(iso: string): HTMLButtonElement {
  return screen.getByTestId(`calendar-day-${iso}`) as HTMLButtonElement;
}

describe('client booking flow with a selected service', () => {
  beforeEach(() => {
    hookState.mode = 'single';
    // Thursday 12 November 2026: the calendar shows November.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dates mode: keeps the one-time / multiple-dates switch for a client', () => {
    renderForm({ openDates: new Set(['2026-11-20']) });

    expect(screen.getByText('Разовая')).toBeTruthy();
    expect(screen.getByText('Регулярная')).toBeTruthy();
  });

  it('dates mode: only open days are selectable in single-date mode', () => {
    renderForm({ openDates: new Set(['2026-11-20']) });

    expect(day('2026-11-20').disabled).toBe(false);
    expect(day('2026-11-19').disabled).toBe(true);
  });

  it('dates mode: only open days are selectable in multiple-dates mode too', () => {
    hookState.mode = 'multi';
    renderForm({ openDates: new Set(['2026-11-20', '2026-11-23']) });

    expect(screen.getByText('Выберите дни')).toBeTruthy();
    expect(day('2026-11-20').disabled).toBe(false);
    expect(day('2026-11-23').disabled).toBe(false);
    expect(day('2026-11-19').disabled).toBe(true);
    expect(day('2026-11-24').disabled).toBe(true);
  });

  it('weekly mode: the client flow keeps the one-time / multiple switch', () => {
    renderForm({ workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }] });

    expect(screen.getByText('Разовая')).toBeTruthy();
    expect(screen.getByText('Регулярная')).toBeTruthy();
  });
});
