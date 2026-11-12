import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';

import ru from '../../../../../../messages/ru.json';
import SchedulePage from '../page';

import type { TAdminScheduleContext, TRoomResponse } from '@/lib/types';

const updateScheduleSettingsSpy = vi.hoisted(() => vi.fn());
const updateWorkingHoursSpy = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const state = vi.hoisted(() => ({ context: null as unknown as TAdminScheduleContext }));

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      updateScheduleSettings: (...args: unknown[]) => updateScheduleSettingsSpy(...args),
      updateWorkingHours: (...args: unknown[]) => updateWorkingHoursSpy(...args),
      updateProfile: vi.fn(),
    },
  },
}));

const roomState = vi.hoisted(() => ({ room: { room: null } as unknown as TRoomResponse }));

vi.mock('@/hooks/queries', () => ({
  useAdminRoom: () => ({ data: roomState.room, isLoading: false }),
  useSpecialist: () => ({ data: null, isLoading: false }),
  useAdminWorkingHours: () => ({
    data: [{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }],
    isLoading: false,
  }),
  useAdminScheduleContext: () => ({ data: state.context, isLoading: false }),
}));

vi.mock('@/hooks/mutations', () => ({
  invalidateSpecialist: vi.fn(),
  invalidateWorkingHours: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings/schedule',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

function renderPage(): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <SchedulePage />
    </NextIntlClientProvider>,
  );
}

function datesSectionSave(): HTMLElement {
  return within(screen.getByTestId('dates-schedule-section')).getByRole('button', {
    name: 'Сохранить изменения',
  });
}

describe('SchedulePage modes', () => {
  beforeEach(() => {
    updateScheduleSettingsSpy.mockReset().mockResolvedValue({
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
      autoOpened: 0,
    });
    updateWorkingHoursSpy.mockReset().mockResolvedValue([]);
    roomState.room = { room: null };
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'weekly',
      defaultIntervals: [],
      workDates: [],
    };
  });

  it('shows the weekly editor by default and keeps the weekly save working', async () => {
    renderPage();

    expect(screen.getByText('Рабочие дни')).toBeTruthy();
    expect(screen.queryByTestId('dates-schedule-section')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить изменения' })[0]);
    await waitFor(() => expect(updateWorkingHoursSpy).toHaveBeenCalledTimes(1));
    expect(updateScheduleSettingsSpy).not.toHaveBeenCalled();
  });

  it('asks for confirmation before switching weekly to dates, then saves defaults', async () => {
    updateScheduleSettingsSpy.mockResolvedValue({
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
      autoOpened: 2,
    });
    renderPage();

    fireEvent.click(screen.getByTestId('schedule-mode-dates'));
    expect(
      screen.getByText('Клиенты видят только дни, которые вы открыли в календаре'),
    ).toBeTruthy();
    // Default hours are 10:00-20:00 when none were saved.
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('20:00')).toBeTruthy();

    fireEvent.click(datesSectionSave());
    expect(await screen.findByText(ru.AdminSchedule.switchToDatesDescription)).toBeTruthy();
    expect(updateScheduleSettingsSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Перейти' }));
    await waitFor(() => expect(updateScheduleSettingsSpy).toHaveBeenCalledTimes(1));
    expect(updateScheduleSettingsSpy).toHaveBeenCalledWith({
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
    });
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Открыто дней с записями: 2'),
    );
  });

  it('does not toast about auto-opened days when there were none', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('schedule-mode-dates'));
    fireEvent.click(datesSectionSave());
    fireEvent.click(await screen.findByRole('button', { name: 'Перейти' }));

    await waitFor(() => expect(updateScheduleSettingsSpy).toHaveBeenCalled());
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(toastMock.success.mock.calls.map((c) => c[0])).not.toContain(
      'Открыто дней с записями: 0',
    );
  });

  it('saves straight away when the specialist is already in dates mode', async () => {
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '08:00', endTime: '12:00' }],
      workDates: [],
    };
    renderPage();

    // The tab starts on "By dates" and shows the saved default hours and the calendar link.
    expect(screen.getByTestId('dates-schedule-section')).toBeTruthy();
    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Рабочие дни/ }).getAttribute('href')).toBe(
      '/admin/settings/work-days',
    );

    fireEvent.click(datesSectionSave());
    await waitFor(() => expect(updateScheduleSettingsSpy).toHaveBeenCalledTimes(1));
    expect(updateScheduleSettingsSpy).toHaveBeenCalledWith({
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '08:00', endTime: '12:00' }],
    });
    expect(screen.queryByText(ru.AdminSchedule.switchToDatesDescription)).toBeNull();
  });

  it('counts open dates of the next two weeks in the link subtitle', () => {
    const today = new Date();
    const iso = (offset: number): string => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
      workDates: [
        { date: iso(1), intervals: [], custom: false },
        { date: iso(3), intervals: [], custom: false },
        { date: iso(-2), intervals: [], custom: false },
        { date: iso(-9), intervals: [], custom: false },
        { date: iso(40), intervals: [], custom: false },
      ],
    };
    renderPage();

    expect(screen.getByText('Открыто 2 дня в ближайшие 2 недели')).toBeTruthy();
  });

  it('switching back to weekly saves the weekly mode together with the hours', async () => {
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '08:00', endTime: '12:00' }],
      workDates: [],
    };
    renderPage();

    fireEvent.click(screen.getByTestId('schedule-mode-weekly'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить изменения' })[0]);

    await waitFor(() => expect(updateScheduleSettingsSpy).toHaveBeenCalledTimes(1));
    expect(updateWorkingHoursSpy).toHaveBeenCalledTimes(1);
    expect(updateScheduleSettingsSpy).toHaveBeenCalledWith({
      scheduleMode: 'weekly',
      defaultIntervals: [{ startTime: '08:00', endTime: '12:00' }],
    });
  });

  it('no longer renders a room block in the dates tab', () => {
    state.context = { ...state.context, scheduleMode: 'dates' };
    renderPage();
    expect(screen.queryByTestId('schedule-room-block')).toBeNull();

    roomState.room = {
      room: { id: 'r1', name: 'На Ленина', isCreator: true },
      members: [{ id: 'a', name: 'A', color: 'green' }],
    };
    renderPage();
    expect(screen.queryByTestId('schedule-room-block')).toBeNull();
  });

  describe('while in a shared room', () => {
    beforeEach(() => {
      state.context = {
        workingHours: [],
        daysOff: [],
        scheduleMode: 'dates',
        defaultIntervals: [{ startTime: '10:00', endTime: '20:00' }],
        workDates: [],
      };
      roomState.room = {
        room: { id: 'r1', name: 'На Ленина', isCreator: true },
        members: [{ id: 'a', name: 'A', color: 'green' }],
      };
    });

    it('disables the weekly tab visibly and explains why', () => {
      renderPage();

      const weekly = screen.getByTestId('schedule-mode-weekly') as HTMLButtonElement;
      expect(weekly.disabled).toBe(true);
      expect(weekly.className).toContain('disabled:opacity-40');
      const hint = screen.getByTestId('schedule-room-weekly-hint');
      expect(hint.textContent).toContain(ru.AdminSchedule.roomRequiresDates);
      expect(within(hint).getByRole('link', { name: 'Открыть кабинет' }).getAttribute('href')).toBe(
        '/admin/settings/room',
      );

      fireEvent.click(weekly);
      expect(screen.getByTestId('dates-schedule-section')).toBeTruthy();
    });

    it('keeps the weekly tab enabled and shows no hint when working alone', () => {
      roomState.room = { room: null };
      renderPage();

      expect((screen.getByTestId('schedule-mode-weekly') as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect(screen.queryByTestId('schedule-room-weekly-hint')).toBeNull();
    });
  });

  it('shows the backend message when switching back to weekly is refused with 409', async () => {
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '08:00', endTime: '12:00' }],
      workDates: [],
    };
    updateScheduleSettingsSpy.mockRejectedValueOnce(new ApiError('Leave the room first', 409));
    renderPage();

    fireEvent.click(screen.getByTestId('schedule-mode-weekly'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Сохранить изменения' })[0]);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Leave the room first'));
  });
});
