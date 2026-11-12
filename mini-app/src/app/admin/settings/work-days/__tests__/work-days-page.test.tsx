import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkDatesConflictError } from '@/lib/api-error';

import ru from '../../../../../../messages/ru.json';
import WorkDaysPage from '../page';

import type { TAdminScheduleContext } from '@/lib/types';

const updateWorkDatesSpy = vi.hoisted(() => vi.fn());
const invalidateSpy = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

const state = vi.hoisted(() => ({
  context: null as unknown as TAdminScheduleContext,
}));

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      updateWorkDates: (...args: unknown[]) => updateWorkDatesSpy(...args),
    },
  },
}));

vi.mock('@/hooks/queries', () => ({
  useAdminRoom: () => ({ data: { room: null }, isLoading: false }),
  useAdminScheduleContext: () => ({
    data: state.context,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock('@/hooks/mutations', () => ({
  invalidateWorkDates: () => invalidateSpy(),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings/work-days',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

const custom = [{ startTime: '12:00', endTime: '16:00' }];
const defaults = [{ startTime: '10:00', endTime: '20:00' }];

function context(overrides: Partial<TAdminScheduleContext> = {}): TAdminScheduleContext {
  return {
    workingHours: [],
    daysOff: [],
    scheduleMode: 'dates',
    defaultIntervals: defaults,
    workDates: [],
    ...overrides,
  };
}

function renderPage(): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <WorkDaysPage />
    </NextIntlClientProvider>,
  );
}

function day(iso: string): HTMLButtonElement {
  return screen.getByTestId(`calendar-day-${iso}`) as HTMLButtonElement;
}

function lastPayload(): { open: unknown[]; close: unknown[] } {
  const calls = updateWorkDatesSpy.mock.calls;
  return calls[calls.length - 1][0] as { open: unknown[]; close: unknown[] };
}

describe('WorkDaysPage', () => {
  beforeEach(() => {
    // Thursday 12 November 2026: the visible month is November 2026.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
    state.context = context({
      workDates: [{ date: '2026-11-20', intervals: defaults, custom: false }],
    });
    updateWorkDatesSpy.mockReset().mockResolvedValue([]);
    invalidateSpy.mockReset().mockResolvedValue(undefined);
    toastMock.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows no save bar until the draft differs from the server', () => {
    renderPage();
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();
  });

  it('opens a closed future date in the draft and saves the diff', async () => {
    renderPage();

    fireEvent.click(day('2026-11-18'));
    expect(screen.getByText('Изменений: 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toEqual({
      open: [{ date: '2026-11-18', intervals: null }],
      close: [],
    });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('work-days-save-bar')).toBeNull());
  });

  it('does not let past dates be opened', () => {
    renderPage();
    expect(day('2026-11-10').disabled).toBe(true);
    fireEvent.click(day('2026-11-10'));
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();
  });

  it('closes an open date from its sheet and sends it in close', async () => {
    renderPage();

    fireEvent.click(day('2026-11-20'));
    expect(await screen.findByText('Пятница, 20 ноября')).toBeTruthy();
    expect(screen.getByTestId('work-day-hours').textContent).toBe('По умолчанию 10-20');

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть день' }));
    expect(screen.getByText('Изменений: 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalled());
    expect(lastPayload()).toEqual({ open: [], close: ['2026-11-20'] });
  });

  it('restores the default hours of a custom date', async () => {
    state.context = context({
      workDates: [{ date: '2026-11-20', intervals: custom, custom: true }],
    });
    renderPage();

    fireEvent.click(day('2026-11-20'));
    expect((await screen.findByTestId('work-day-hours')).textContent).toBe('Свои часы: 12-16');

    fireEvent.click(screen.getByRole('button', { name: 'Вернуть часы по умолчанию' }));
    expect(screen.getByTestId('work-day-hours').textContent).toBe('По умолчанию 10-20');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      open: [{ date: '2026-11-20', intervals: null }],
      close: [],
    });
  });

  it('blocks closing a day with bookings and links to those bookings', async () => {
    state.context = context({
      workDates: [{ date: '2026-11-20', intervals: defaults, custom: false, bookingCount: 1 }],
    });
    renderPage();

    expect(screen.getByTestId('calendar-mark-2026-11-20')).toBeTruthy();
    fireEvent.click(day('2026-11-20'));

    const closeButton = (await screen.findByRole('button', {
      name: 'Закрыть день',
    })) as HTMLButtonElement;
    expect(closeButton.disabled).toBe(true);
    expect(screen.getByText('На этот день 1 запись')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Перейти к записям' });
    expect(link.getAttribute('href')).toBe('/admin/bookings?dateFrom=2026-11-20&dateTo=2026-11-20');
  });

  it('resets the draft', () => {
    renderPage();
    fireEvent.click(day('2026-11-18'));
    expect(screen.getByTestId('work-days-save-bar')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();
  });

  it('keeps the draft and lists the dates when the server answers 409', async () => {
    updateWorkDatesSpy.mockRejectedValueOnce(
      new WorkDatesConflictError('conflict', ['2026-11-20']),
    );
    renderPage();

    fireEvent.click(day('2026-11-20'));
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть день' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls[0][0]).toContain('20 ноября');
    expect(screen.getByText('Изменений: 1')).toBeTruthy();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('shows a generic error on other failures and keeps the draft', async () => {
    updateWorkDatesSpy.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    fireEvent.click(day('2026-11-18'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(ru.Errors.saveFailed));
    expect(screen.getByText('Изменений: 1')).toBeTruthy();
  });

  it('repeats the previous week into the first empty week, keeping custom hours', async () => {
    // Current week (9-15 Nov) has Fri 13 (default) and Sat 14 (custom).
    state.context = context({
      workDates: [
        { date: '2026-11-13', intervals: defaults, custom: false },
        { date: '2026-11-14', intervals: custom, custom: true },
      ],
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Повторить прошлую неделю/ }));
    expect(screen.getByText('Изменений: 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      open: [
        { date: '2026-11-20', intervals: null },
        { date: '2026-11-21', intervals: custom },
      ],
      close: [],
    });
  });

  it('says there is nothing to repeat when the source week is empty', () => {
    state.context = context({ workDates: [] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Повторить прошлую неделю/ }));
    expect(toastMock).toHaveBeenCalledWith('Нечего повторять');
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();
  });

  it('fills alternating weeks without removing anything', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Чередование недель/ }));
    fireEvent.click(await within(await screen.findByTestId('alt-week-a')).findByText('Пт'));
    fireEvent.click(within(screen.getByTestId('alt-week-b')).getByText('Сб'));
    fireEvent.click(screen.getByRole('button', { name: 'Заполнить' }));

    // Week 0 (A, Fri 13), week 1 (B, Sat 21), week 2 (A, Fri 27), week 3 (B, Sat 5 Dec).
    await waitFor(() => expect(screen.getByText('Изменений: 4')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      open: [
        { date: '2026-11-13', intervals: null },
        { date: '2026-11-21', intervals: null },
        { date: '2026-11-27', intervals: null },
        { date: '2026-12-05', intervals: null },
      ],
      close: [],
    });
  });

  it('takes booking dots from bookedDates, including dates that are not open', () => {
    state.context = context({
      workDates: [],
      bookedDates: [{ date: '2026-11-25', bookingCount: 2 }],
    });
    renderPage();

    expect(screen.getByTestId('calendar-mark-2026-11-25')).toBeTruthy();
    expect(screen.queryByTestId('calendar-mark-2026-11-26')).toBeNull();
  });

  it('shows the booking count from bookedDates in the day sheet', async () => {
    state.context = context({
      workDates: [{ date: '2026-11-20', intervals: defaults, custom: false }],
      bookedDates: [{ date: '2026-11-20', bookingCount: 3 }],
    });
    renderPage();

    fireEvent.click(day('2026-11-20'));
    expect(await screen.findByText('На этот день 3 записи')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Закрыть день' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('renders past open dates read-only and never sends them', async () => {
    state.context = context({
      workDates: [
        { date: '2026-11-09', intervals: defaults, custom: false },
        { date: '2026-11-11', intervals: custom, custom: true, bookingCount: 1 },
      ],
    });
    renderPage();

    // Rendered as open (filled) but disabled and untappable.
    expect(day('2026-11-09').disabled).toBe(true);
    expect(day('2026-11-09').querySelector('span')?.className).toContain('bg-brand');
    fireEvent.click(day('2026-11-09'));
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();

    fireEvent.click(day('2026-11-18'));
    expect(screen.getByText('Изменений: 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      open: [{ date: '2026-11-18', intervals: null }],
      close: [],
    });
  });

  it('repeats Mon/Wed/Fri opened this week (past days included) into next week', async () => {
    // Today is Thursday 12th: Mon 9 and Wed 11 are past, Fri 13 is not.
    state.context = context({
      workDates: [
        { date: '2026-11-09', intervals: defaults, custom: false },
        { date: '2026-11-11', intervals: custom, custom: true },
        { date: '2026-11-13', intervals: defaults, custom: false },
      ],
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Повторить прошлую неделю/ }));
    expect(screen.getByText('Изменений: 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateWorkDatesSpy).toHaveBeenCalled());
    expect(lastPayload()).toEqual({
      open: [
        { date: '2026-11-16', intervals: null },
        { date: '2026-11-18', intervals: custom },
        { date: '2026-11-20', intervals: null },
      ],
      close: [],
    });
  });

  it('warns that opened days have no effect while the weekly schedule is on', () => {
    state.context = context({ scheduleMode: 'weekly' });
    renderPage();
    expect(screen.getByTestId('work-days-weekly-note')).toBeTruthy();
  });

  it('does not show the weekly note in dates mode', () => {
    renderPage();
    expect(screen.queryByTestId('work-days-weekly-note')).toBeNull();
  });
});
