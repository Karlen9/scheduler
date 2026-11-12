import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ru from '../../../../messages/ru.json';
import { BookingForm } from '../index';

import type { TBookingFormProps, TClientInfo } from '@/lib/types';

const captured = vi.hoisted(() => ({
  onetime: null as null | Record<string, unknown>,
  recurring: null as null | Record<string, unknown>,
}));

vi.mock('../OnetimeBookingFlow', () => ({
  OnetimeBookingFlow: (props: Record<string, unknown>): React.ReactNode => {
    captured.onetime = props;
    return <div data-testid={'onetime-flow'} />;
  },
}));

vi.mock('../RecurringBookingFlow', () => ({
  RecurringBookingFlow: (props: Record<string, unknown>): React.ReactNode => {
    captured.recurring = props;
    return <div data-testid={'recurring-flow'} />;
  },
}));

vi.mock('@/hooks/queries', () => ({
  useAdminClientBatches: () => ({ data: [], isLoading: false }),
}));

const weeklyHours = [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }];

const baseProps: TBookingFormProps = {
  services: [],
  workingHours: weeklyHours,
  daysOff: [],
  isLoading: false,
  showRecurring: true,
  onCreateBooking: async () => undefined,
  onCreateRecurring: async () => undefined,
  onPreviewRecurring: async () => Promise.resolve({ dates: [] }),
  successRedirect: '/',
};

const specialistClient = { id: 'c1', name: 'Anna', createdAt: '' } as unknown as TClientInfo;

function renderForm(props: Partial<TBookingFormProps>): void {
  render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <BookingForm {...baseProps} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('BookingForm schedule modes', () => {
  beforeEach(() => {
    captured.onetime = null;
    captured.recurring = null;
  });

  it('weekly mode: derives non-working weekdays from the hours and passes no openDates', () => {
    renderForm({});

    expect(screen.getByRole('button', { name: ru.BookingForm.recurring })).toBeTruthy();
    expect(captured.onetime?.nonWorkingDays).toEqual([0, 2, 3, 4, 5, 6]);
    expect(captured.onetime?.openDates).toBeUndefined();
  });

  it('dates mode: passes openDates and no weekday rules to the calendar', () => {
    const openDates = new Set(['2026-11-20']);
    renderForm({ openDates, workingHours: [] });

    expect(captured.onetime?.nonWorkingDays).toEqual([]);
    expect(captured.onetime?.openDates).toBe(openDates);
  });

  it('dates mode: hides the recurring toggle for clients', () => {
    renderForm({ openDates: new Set(['2026-11-20']) });

    expect(screen.queryByRole('button', { name: ru.BookingForm.recurring })).toBeNull();
  });

  it('dates mode: keeps the recurring toggle for the specialist and explains the open-days rule', () => {
    renderForm({
      openDates: new Set(['2026-11-20']),
      initialSelectedClient: specialistClient,
      defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
    });

    expect(screen.queryByText(ru.BookingForm.recurringDatesHint)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: ru.BookingForm.recurring }));

    expect(screen.getByText('Серия создаётся только на открытые дни')).toBeTruthy();
    const hours = captured.recurring?.workingHours as { dayOfWeek: number; startTime: string }[];
    expect(new Set(hours.map((h) => h.dayOfWeek)).size).toBe(7);
    expect(hours[0].startTime).toBe('10:00');
  });

  it('weekly mode: the recurring flow keeps the weekly hours and shows no hint', () => {
    renderForm({ initialSelectedClient: specialistClient });

    fireEvent.click(screen.getByRole('button', { name: ru.BookingForm.recurring }));
    expect(captured.recurring?.workingHours).toBe(weeklyHours);
    expect(screen.queryByText(ru.BookingForm.recurringDatesHint)).toBeNull();
  });
});
