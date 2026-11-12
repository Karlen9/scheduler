import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomError } from '@/lib/api-error';

import ru from '../../../../../../messages/ru.json';
import WorkDaysPage from '../page';

import type { TAdminScheduleContext, TRoomResponse } from '@/lib/types';

const spies = vi.hoisted(() => ({
  updateRoomDays: vi.fn(),
  updateWorkDates: vi.fn(),
  createRoomRequest: vi.fn(),
  cancelRoomRequest: vi.fn(),
  acceptRoomRequest: vi.fn(),
  declineRoomRequest: vi.fn(),
  invalidateRoom: vi.fn(),
  invalidateWorkDates: vi.fn(),
  copyText: vi.fn(),
}));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
const state = vi.hoisted(() => ({
  room: { room: null } as unknown as TRoomResponse,
  context: null as unknown as TAdminScheduleContext,
}));

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      updateRoomDays: (...a: unknown[]) => spies.updateRoomDays(...a),
      updateWorkDates: (...a: unknown[]) => spies.updateWorkDates(...a),
      createRoomRequest: (...a: unknown[]) => spies.createRoomRequest(...a),
      cancelRoomRequest: (...a: unknown[]) => spies.cancelRoomRequest(...a),
      acceptRoomRequest: (...a: unknown[]) => spies.acceptRoomRequest(...a),
      declineRoomRequest: (...a: unknown[]) => spies.declineRoomRequest(...a),
    },
  },
}));

vi.mock('@/hooks/queries', () => ({
  useAdminRoom: () => ({ data: state.room, isLoading: false, mutate: vi.fn() }),
  useAdminScheduleContext: () => ({ data: state.context, isLoading: false, mutate: vi.fn() }),
}));

vi.mock('@/hooks/mutations', () => ({
  invalidateRoom: () => spies.invalidateRoom(),
  invalidateWorkDates: () => spies.invalidateWorkDates(),
}));

vi.mock('@/lib/clipboard', () => ({ copyText: (...a: unknown[]) => spies.copyText(...a) }));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings/work-days',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

const defaults = [{ startTime: '10:00', endTime: '20:00' }];
const custom = [{ startTime: '12:00', endTime: '16:00' }];

function roomResponse(overrides: Partial<TRoomResponse> = {}): TRoomResponse {
  return {
    room: { id: 'r1', name: 'Кабинет на Ленина', isCreator: true },
    meMemberId: 'me',
    members: [
      { id: 'me', name: 'Вера', color: 'green', linked: true, isMe: true },
      { id: 'b1', name: 'Борис', color: 'violet', linked: false },
      { id: 'a1', name: 'Аня', color: 'orange', linked: true },
    ],
    days: [
      { date: '2026-11-10', memberId: 'me' }, // past
      { date: '2026-11-13', memberId: 'me' },
      { date: '2026-11-14', memberId: 'b1' },
      { date: '2026-11-16', memberId: 'a1' },
    ],
    requests: { incoming: [], outgoing: [] },
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

function fill(iso: string): string {
  return (day(iso).querySelector('span') as HTMLElement).style.backgroundColor;
}

function saveBar(): HTMLElement {
  return screen.getByTestId('work-days-save-bar');
}

function lastAssign(): unknown {
  const calls = spies.updateRoomDays.mock.calls;
  return calls[calls.length - 1][0];
}

describe('WorkDaysPage in a room', () => {
  beforeEach(() => {
    // Thursday 12 November 2026.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
    Object.values(spies).forEach((s) => s.mockReset());
    spies.updateRoomDays.mockResolvedValue({});
    spies.updateWorkDates.mockResolvedValue([]);
    spies.createRoomRequest.mockResolvedValue(undefined);
    spies.cancelRoomRequest.mockResolvedValue(undefined);
    spies.acceptRoomRequest.mockResolvedValue(undefined);
    spies.declineRoomRequest.mockResolvedValue(undefined);
    spies.invalidateRoom.mockResolvedValue(undefined);
    spies.invalidateWorkDates.mockResolvedValue(undefined);
    spies.copyText.mockResolvedValue(true);
    toastMock.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    state.room = roomResponse();
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'dates',
      defaultIntervals: defaults,
      workDates: [
        { date: '2026-11-10', intervals: defaults, custom: false },
        { date: '2026-11-13', intervals: custom, custom: true },
      ],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('colours every day with its owner and leaves free days plain', () => {
    renderPage();

    expect(screen.getByTestId('room-work-days')).toBeTruthy();
    expect(fill('2026-11-13')).toBe('var(--room-green)');
    expect(fill('2026-11-14')).toBe('var(--room-violet)');
    expect(fill('2026-11-16')).toBe('var(--room-orange)');
    expect(fill('2026-11-18')).toBe('');
  });

  it('links to the room members page', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Участники кабинета' }).getAttribute('href')).toBe(
      '/admin/settings/room',
    );
  });

  it('shows the legend with every member and "free"', () => {
    renderPage();
    const legend = screen.getByTestId('room-legend');
    for (const label of ['Вы', 'Борис', 'Аня', 'Свободен', 'Есть записи']) {
      expect(within(legend).getByText(label)).toBeTruthy();
    }
  });

  it('keeps past days read-only', () => {
    renderPage();
    expect(day('2026-11-10').disabled).toBe(true);
    fireEvent.click(day('2026-11-10'));
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();
  });

  it('assigns a free day to me through the owner sheet and saves the assignment', async () => {
    renderPage();

    fireEvent.click(day('2026-11-18'));
    expect(await screen.findByText('Кто в кабинете ср, 18 ноября?')).toBeTruthy();
    // A free day offers me and the offline colleague, not a linked one, and not "free".
    expect(screen.getByTestId('room-day-option-me')).toBeTruthy();
    expect(screen.getByTestId('room-day-option-b1')).toBeTruthy();
    expect(screen.queryByTestId('room-day-option-a1')).toBeNull();
    expect(screen.queryByTestId('room-day-option-free')).toBeNull();

    fireEvent.click(screen.getByTestId('room-day-option-me'));
    expect(fill('2026-11-18')).toBe('var(--room-green)');
    expect(within(saveBar()).getByText('Изменений: 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(spies.updateRoomDays).toHaveBeenCalledTimes(1));
    expect(lastAssign()).toEqual([{ date: '2026-11-18', memberId: 'me' }]);
    expect(spies.updateWorkDates).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('work-days-save-bar')).toBeNull());
  });

  it('frees my day or gives it to an offline colleague', async () => {
    renderPage();

    fireEvent.click(day('2026-11-13'));
    fireEvent.click(await screen.findByRole('button', { name: 'Освободить' }));
    expect(fill('2026-11-13')).toBe('');

    fireEvent.click(day('2026-11-14')); // Boris's day -> free it
    fireEvent.click(await screen.findByTestId('room-day-option-free'));
    expect(fill('2026-11-14')).toBe('');

    fireEvent.click(day('2026-11-18'));
    fireEvent.click(await screen.findByTestId('room-day-option-b1'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(spies.updateRoomDays).toHaveBeenCalled());
    expect(lastAssign()).toEqual([
      { date: '2026-11-13', memberId: '' },
      { date: '2026-11-14', memberId: '' },
      { date: '2026-11-18', memberId: 'b1' },
    ]);
  });

  it('gives my day to an offline colleague from the day sheet', async () => {
    renderPage();

    fireEvent.click(day('2026-11-13'));
    fireEvent.click(await screen.findByTestId('give-to-b1'));
    expect(fill('2026-11-13')).toBe('var(--room-violet)');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(spies.updateRoomDays).toHaveBeenCalled());
    expect(lastAssign()).toEqual([{ date: '2026-11-13', memberId: 'b1' }]);
  });

  it('blocks giving away or freeing a day that has bookings', async () => {
    state.context = { ...state.context, bookedDates: [{ date: '2026-11-13', bookingCount: 2 }] };
    renderPage();

    expect(screen.getByTestId('calendar-mark-2026-11-13')).toBeTruthy();
    fireEvent.click(day('2026-11-13'));
    expect(await screen.findByText('На этот день 2 записи')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Освободить' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByTestId('give-to-b1') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets me restore default hours of my own day and sends them as a work-dates change', async () => {
    renderPage();

    fireEvent.click(day('2026-11-13'));
    expect((await screen.findByTestId('work-day-hours')).textContent).toBe('Свои часы: 12-16');
    fireEvent.click(screen.getByRole('button', { name: 'Вернуть часы по умолчанию' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(spies.updateWorkDates).toHaveBeenCalledTimes(1));
    expect(spies.updateWorkDates).toHaveBeenCalledWith({
      open: [{ date: '2026-11-13', intervals: null }],
      close: [],
    });
    expect(spies.updateRoomDays).not.toHaveBeenCalled();
  });

  it('saves assignments first, then hour changes', async () => {
    renderPage();

    fireEvent.click(day('2026-11-18'));
    fireEvent.click(await screen.findByTestId('room-day-option-me'));
    fireEvent.click(day('2026-11-13'));
    fireEvent.click(await screen.findByRole('button', { name: 'Вернуть часы по умолчанию' }));
    expect(within(saveBar()).getByText('Изменений: 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(spies.updateWorkDates).toHaveBeenCalled());
    expect(spies.updateRoomDays.mock.invocationCallOrder[0]).toBeLessThan(
      spies.updateWorkDates.mock.invocationCallOrder[0],
    );
  });

  it('reports a partial save when the hours fail after the assignments went through', async () => {
    spies.updateWorkDates.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    fireEvent.click(day('2026-11-18'));
    fireEvent.click(await screen.findByTestId('room-day-option-me'));
    fireEvent.click(day('2026-11-13'));
    fireEvent.click(await screen.findByRole('button', { name: 'Вернуть часы по умолчанию' }));
    expect(within(saveBar()).getByText('Изменений: 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(ru.AdminWorkDays.partialSave));
    expect(toastMock.success).not.toHaveBeenCalled();

    // Only the hours part stays in the draft.
    await waitFor(() => expect(within(saveBar()).getByText('Изменений: 1')).toBeTruthy());

    // A second Save sends just the hours.
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(spies.updateWorkDates).toHaveBeenCalledTimes(2));
    expect(spies.updateRoomDays).toHaveBeenCalledTimes(1);
    expect(spies.updateWorkDates).toHaveBeenLastCalledWith({
      open: [{ date: '2026-11-13', intervals: null }],
      close: [],
    });
    await waitFor(() => expect(screen.queryByTestId('work-days-save-bar')).toBeNull());
  });

  it('uses the generic error when the assignments themselves fail', async () => {
    spies.updateRoomDays.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    fireEvent.click(day('2026-11-18'));
    fireEvent.click(await screen.findByTestId('room-day-option-me'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(ru.Errors.saveFailed));
    expect(spies.updateWorkDates).not.toHaveBeenCalled();
  });

  it('keeps the draft and lists the dates when the server answers 409', async () => {
    spies.updateRoomDays.mockRejectedValueOnce(
      new RoomError('День занят', 409, ['2026-11-18'], 'Error.RoomDayTaken'),
    );
    renderPage();

    fireEvent.click(day('2026-11-18'));
    fireEvent.click(await screen.findByTestId('room-day-option-me'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('День занят: 18 ноября'));
    expect(within(saveBar()).getByText('Изменений: 1')).toBeTruthy();
  });

  it("only offers to request a linked colleague's day, never to assign it", async () => {
    renderPage();

    fireEvent.click(day('2026-11-16'));
    expect(await screen.findByText('пн, 16 ноября · Аня')).toBeTruthy();
    expect(screen.queryByTestId('room-day-options')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Попросить этот день' }));
    await waitFor(() => expect(spies.createRoomRequest).toHaveBeenCalledWith('2026-11-16'));
    await waitFor(() => expect(spies.invalidateRoom).toHaveBeenCalled());
    expect(screen.queryByTestId('work-days-save-bar')).toBeNull();
  });

  it('shows "request sent" with a cancel action when a request is pending', async () => {
    state.room = roomResponse({
      requests: { incoming: [], outgoing: [{ id: 'q9', date: '2026-11-16', toMemberId: 'a1' }] },
    });
    renderPage();

    fireEvent.click(day('2026-11-16'));
    expect(await screen.findByText('Запрос отправлен')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Попросить этот день' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Отменить запрос' }));
    await waitFor(() => expect(spies.cancelRoomRequest).toHaveBeenCalledWith('q9'));
  });

  it('accepts and declines incoming requests for my days', async () => {
    state.room = roomResponse({
      requests: {
        incoming: [
          { id: 'q1', date: '2026-11-13', fromMemberId: 'a1' },
          { id: 'q2', date: '2026-11-20', fromMemberId: 'a1' },
        ],
        outgoing: [],
      },
    });
    renderPage();

    const block = screen.getByTestId('room-incoming-requests');
    expect(within(block).getByText('Аня просит пт, 13 ноября')).toBeTruthy();
    const [accept] = within(block).getAllByRole('button', { name: 'Отдать' });
    fireEvent.click(accept);
    await waitFor(() => expect(spies.acceptRoomRequest).toHaveBeenCalledWith('q1'));

    const [decline] = within(block).getAllByRole('button', { name: 'Отказать' });
    fireEvent.click(decline);
    await waitFor(() => expect(spies.declineRoomRequest).toHaveBeenCalledWith('q1'));
  });

  it('tells me to move bookings first when accepting a request answers 409', async () => {
    spies.acceptRoomRequest.mockRejectedValueOnce(new RoomError('x', 409, ['2026-11-13']));
    state.room = roomResponse({
      requests: { incoming: [{ id: 'q1', date: '2026-11-13', fromMemberId: 'a1' }], outgoing: [] },
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Отдать' }));
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith('Сначала перенесите записи на этот день'),
    );
    expect(spies.declineRoomRequest).not.toHaveBeenCalled();
  });

  it('fills alternating weeks per member without touching a linked colleague', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Чередование недель/ }));
    fireEvent.click(await within(await screen.findByTestId('alt-week-a-me')).findByText('Пт'));
    fireEvent.click(within(screen.getByTestId('alt-week-b-b1')).getByText('Сб'));
    // The linked colleague has no row: only me and offline members are assignable.
    expect(screen.queryByTestId('alt-week-a-a1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Заполнить' }));

    // Week 0 (A): Fri 13 is already mine. Week 1 (B): Sat 21 -> Борис. Week 2 (A): Fri 27 -> me.
    // Week 3 (B): Sat 5 Dec -> Борис.
    await waitFor(() => expect(screen.getByText('Изменений: 3')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(spies.updateRoomDays).toHaveBeenCalled());
    expect(lastAssign()).toEqual([
      { date: '2026-11-21', memberId: 'b1' },
      { date: '2026-11-27', memberId: 'me' },
      { date: '2026-12-05', memberId: 'b1' },
    ]);
  });

  it('repeats my and offline days onto free days of the next week', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Повторить прошлую неделю/ }));
    // Source = current week (9-15): Tue 10 (me), Fri 13 (me), Sat 14 (Борис) -> 17, 20, 21.
    // Monday 16 stays with Аня.
    await waitFor(() => expect(screen.getByText('Изменений: 3')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(spies.updateRoomDays).toHaveBeenCalled());
    expect(lastAssign()).toEqual([
      { date: '2026-11-17', memberId: 'me' },
      { date: '2026-11-20', memberId: 'me' },
      { date: '2026-11-21', memberId: 'b1' },
    ]);
  });

  it('copies a text schedule of the next four weeks to the clipboard', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать график' }));
    await waitFor(() => expect(spies.copyText).toHaveBeenCalledTimes(1));
    const text = spies.copyText.mock.calls[0][0] as string;
    expect(text.split('\n')[0]).toBe('Кабинет на Ленина, ноябрь–декабрь:');
    expect(text).toContain('Вера — 13');
    expect(text).toContain('Борис — 14');
    expect(text).toContain('Аня — 16');
    expect(toastMock.success).toHaveBeenCalledWith('Скопировано — отправьте коллеге');
  });

  it('starts the copied schedule with "Кабинет" for an unnamed room', async () => {
    state.room = roomResponse({ room: { id: 'r1', name: '', isCreator: true } });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать график' }));
    await waitFor(() => expect(spies.copyText).toHaveBeenCalledTimes(1));
    expect((spies.copyText.mock.calls[0][0] as string).split('\n')[0]).toBe(
      'Кабинет, ноябрь–декабрь:',
    );
  });
});
