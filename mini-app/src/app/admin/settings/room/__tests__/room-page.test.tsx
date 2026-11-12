import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ru from '../../../../../../messages/ru.json';
import RoomPage from '../page';

import type { TAdminScheduleContext, TRoomResponse } from '@/lib/types';

const spies = vi.hoisted(() => ({
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  addRoomMember: vi.fn(),
  updateRoomMember: vi.fn(),
  deleteRoomMember: vi.fn(),
  createRoomMemberInvite: vi.fn(),
  invalidateRoom: vi.fn(),
  shareTelegramLink: vi.fn(),
  copyText: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const state = vi.hoisted(() => ({
  room: { room: null } as unknown as TRoomResponse,
  context: {
    workingHours: [],
    daysOff: [],
    scheduleMode: 'dates',
  } as unknown as TAdminScheduleContext,
}));

vi.mock('@/lib/api', () => ({
  api: {
    admin: {
      createRoom: (...a: unknown[]) => spies.createRoom(...a),
      updateRoom: (...a: unknown[]) => spies.updateRoom(...a),
      addRoomMember: (...a: unknown[]) => spies.addRoomMember(...a),
      updateRoomMember: (...a: unknown[]) => spies.updateRoomMember(...a),
      deleteRoomMember: (...a: unknown[]) => spies.deleteRoomMember(...a),
      createRoomMemberInvite: (...a: unknown[]) => spies.createRoomMemberInvite(...a),
    },
  },
}));

vi.mock('@/hooks/queries', () => ({
  useAdminRoom: () => ({ data: state.room, isLoading: false, mutate: vi.fn() }),
  useAdminScheduleContext: () => ({ data: state.context, isLoading: false }),
}));

vi.mock('@/hooks/mutations', () => ({
  invalidateRoom: () => spies.invalidateRoom(),
}));

vi.mock('@/lib/telegram', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  shareTelegramLink: (...a: unknown[]) => spies.shareTelegramLink(...a),
}));

vi.mock('@/lib/clipboard', () => ({ copyText: (...a: unknown[]) => spies.copyText(...a) }));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings/room',
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

function roomResponse(isCreator = true): TRoomResponse {
  return {
    room: { id: 'r1', name: 'Кабинет на Ленина', isCreator },
    meMemberId: 'me',
    members: [
      { id: 'me', name: 'Вера', color: 'green', linked: true, isMe: true },
      { id: 'b1', name: 'Борис', color: 'violet', linked: false, hasInvite: false },
      { id: 'a1', name: 'Аня', color: 'orange', linked: true },
    ],
    days: [],
    requests: { incoming: [], outgoing: [] },
  };
}

function renderPage(): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <RoomPage />
    </NextIntlClientProvider>,
  );
}

function dialogOf(text: string): HTMLElement {
  return screen.getByText(text).closest('[role="dialog"]') as HTMLElement;
}

describe('RoomPage', () => {
  beforeEach(() => {
    Object.values(spies).forEach((s) => s.mockReset());
    spies.createRoom.mockResolvedValue({});
    spies.updateRoom.mockResolvedValue({});
    spies.addRoomMember.mockResolvedValue({ member: { id: 'n1', name: 'Новый', color: 'violet' } });
    spies.updateRoomMember.mockResolvedValue({});
    spies.deleteRoomMember.mockResolvedValue(undefined);
    spies.createRoomMemberInvite.mockResolvedValue({ inviteLink: 'https://t.me/bot?start=room_x' });
    spies.invalidateRoom.mockResolvedValue(undefined);
    spies.copyText.mockResolvedValue(true);
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    state.room = { room: null };
    state.context = { workingHours: [], daysOff: [], scheduleMode: 'dates' };
  });

  it('creates a room with an optional name when there is none', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Например, Кабинет на Ленина'), {
      target: { value: '  Кабинет на Ленина ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать кабинет' }));

    await waitFor(() => expect(spies.createRoom).toHaveBeenCalledWith('Кабинет на Ленина'));
    await waitFor(() => expect(spies.invalidateRoom).toHaveBeenCalled());
  });

  it('lists members with their badges', () => {
    state.room = roomResponse();
    renderPage();

    expect(screen.getByRole('heading', { name: 'Кабинет на Ленина' })).toBeTruthy();
    expect(screen.queryByText(/Кабинет «/)).toBeNull();
    expect(within(screen.getByTestId('room-member-me')).getByText('вы')).toBeTruthy();
    expect(within(screen.getByTestId('room-member-b1')).getByText('без бота')).toBeTruthy();
    expect(within(screen.getByTestId('room-member-a1')).getByText('с ботом')).toBeTruthy();
  });

  it('adds an offline member with the first unused colour preselected', async () => {
    state.room = roomResponse();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Добавить коллегу/ }));
    // Green, violet and orange are taken: the first free colour is blue.
    expect((await screen.findByTestId('room-color-blue')).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.change(screen.getByPlaceholderText('Например, Аня'), { target: { value: ' Олег ' } });
    fireEvent.click(screen.getByTestId('room-color-pink'));
    fireEvent.click(screen.getByRole('button', { name: 'Отмечать его дни самому' }));

    await waitFor(() =>
      expect(spies.addRoomMember).toHaveBeenCalledWith({
        name: 'Олег',
        color: 'pink',
        invite: false,
      }),
    );
    expect(spies.shareTelegramLink).not.toHaveBeenCalled();
  });

  it('invites a new member by link and offers share and copy', async () => {
    state.room = roomResponse();
    spies.addRoomMember.mockResolvedValue({
      member: { id: 'n1', name: 'Олег', color: 'blue' },
      inviteLink: 'https://t.me/bot?start=room_abc',
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Добавить коллегу/ }));
    fireEvent.change(await screen.findByPlaceholderText('Например, Аня'), {
      target: { value: 'Олег' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Пригласить по ссылке' }));

    await waitFor(() =>
      expect(spies.addRoomMember).toHaveBeenCalledWith({
        name: 'Олег',
        color: 'blue',
        invite: true,
      }),
    );
    expect((await screen.findByTestId('room-invite-link')).textContent).toBe(
      'https://t.me/bot?start=room_abc',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Поделиться в Telegram' }));
    expect(spies.shareTelegramLink).toHaveBeenCalledWith(
      'https://t.me/bot?start=room_abc',
      ru.AdminRoom.inviteShareText,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' }));
    await waitFor(() =>
      expect(spies.copyText).toHaveBeenCalledWith('https://t.me/bot?start=room_abc'),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Ссылка скопирована'));
  });

  it('renames an offline member and changes its colour from the member sheet', async () => {
    state.room = roomResponse();
    renderPage();

    fireEvent.click(screen.getByTestId('room-member-b1'));
    const input = (await screen.findByDisplayValue('Борис')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Борис К.' } });
    fireEvent.click(screen.getByTestId('room-color-teal'));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() =>
      expect(spies.updateRoomMember).toHaveBeenCalledWith('b1', {
        name: 'Борис К.',
        color: 'teal',
      }),
    );
  });

  it('creates an invite for an existing offline member', async () => {
    state.room = roomResponse();
    renderPage();

    fireEvent.click(screen.getByTestId('room-member-b1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить в приложение' }));

    await waitFor(() => expect(spies.createRoomMemberInvite).toHaveBeenCalledWith('b1'));
    expect((await screen.findByTestId('room-invite-link')).textContent).toContain('room_x');
  });

  it('confirms before deleting an offline member', async () => {
    state.room = roomResponse();
    renderPage();

    fireEvent.click(screen.getByTestId('room-member-b1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));

    const dialog = dialogOf('Дни Борис станут свободными.');
    expect(spies.deleteRoomMember).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(spies.deleteRoomMember).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(spies.invalidateRoom).toHaveBeenCalled());
  });

  it('lets only the creator remove a linked colleague', async () => {
    state.room = roomResponse(true);
    const view = renderPage();

    fireEvent.click(screen.getByTestId('room-member-a1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Исключить из кабинета' }));
    fireEvent.click(
      within(dialogOf(ru.AdminRoom.excludeDescription)).getByRole('button', { name: 'Исключить' }),
    );
    await waitFor(() => expect(spies.deleteRoomMember).toHaveBeenCalledWith('a1'));
    view.unmount();

    state.room = roomResponse(false);
    renderPage();
    fireEvent.click(screen.getByTestId('room-member-a1'));
    expect((await screen.findAllByText('Аня')).length).toBe(2); // row + sheet title
    expect(screen.queryByRole('button', { name: 'Исключить из кабинета' })).toBeNull();
    // A linked colleague's colour is theirs to change.
    expect(screen.queryByTestId('room-color-blue')).toBeNull();
  });

  it('leaves the room with my own member id after confirmation', async () => {
    state.room = roomResponse();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Выйти из кабинета' }));
    const dialog = dialogOf('Выйти из кабинета?');
    expect(within(dialog).getByText(ru.AdminRoom.leaveDescription)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    await waitFor(() => expect(spies.deleteRoomMember).toHaveBeenCalledWith('me'));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Вы вышли из кабинета'));
  });

  it('renames the room', async () => {
    state.room = roomResponse();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Переименовать' }));
    fireEvent.change(screen.getByDisplayValue('Кабинет на Ленина'), {
      target: { value: 'Новый кабинет' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(spies.updateRoom).toHaveBeenCalledWith('Новый кабинет'));
  });

  it('shows the backend message when a room request fails', async () => {
    state.room = roomResponse();
    spies.deleteRoomMember.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Выйти из кабинета' }));
    fireEvent.click(within(dialogOf('Выйти из кабинета?')).getByRole('button', { name: 'Выйти' }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(ru.Errors.saveFailed));
  });

  it('links to the work-days calendar and the default hours from the schedule section', () => {
    state.room = roomResponse();
    state.context = {
      workingHours: [],
      daysOff: [],
      scheduleMode: 'dates',
      defaultIntervals: [{ startTime: '09:00', endTime: '18:00' }],
    };
    renderPage();

    const workDays = screen.getByRole('link', { name: /Рабочие дни/ });
    expect(workDays.getAttribute('href')).toBe('/admin/settings/work-days');
    expect(workDays.textContent).toContain('Календарь кабинета: кто в какой день');
    const hours = screen.getByRole('link', { name: /Часы по умолчанию/ });
    expect(hours.getAttribute('href')).toBe('/admin/settings/schedule');
    expect(hours.textContent).toContain('09:00–18:00');
  });

  it('falls back to 10:00–20:00 when no default hours are saved', () => {
    state.room = roomResponse();
    renderPage();
    expect(screen.getByRole('link', { name: /Часы по умолчанию/ }).textContent).toContain(
      '10:00–20:00',
    );
  });

  it('warns that creating a room switches a weekly schedule to dates', () => {
    state.context = { workingHours: [], daysOff: [], scheduleMode: 'weekly' };
    renderPage();
    expect(screen.getByTestId('room-weekly-note').textContent).toBe(ru.AdminRoom.weeklyNote);
  });

  it('shows no weekly note when already working by dates', () => {
    renderPage();
    expect(screen.queryByTestId('room-weekly-note')).toBeNull();
  });

  it('toasts after creating a room and offers to assign days', async () => {
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Создать кабинет' }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Кабинет создан'));

    // The room now exists: the page shows the room view with the call to action.
    state.room = roomResponse();
    view.rerender(
      <NextIntlClientProvider locale={'ru'} messages={ru}>
        <RoomPage />
      </NextIntlClientProvider>,
    );
    const banner = await screen.findByTestId('room-created-banner');
    expect(
      within(banner).getByRole('link', { name: 'Распределить дни' }).getAttribute('href'),
    ).toBe('/admin/settings/work-days');
  });

  it('titles an unnamed room just "Кабинет"', () => {
    state.room = { ...roomResponse(), room: { id: 'r1', name: '', isCreator: true } };
    renderPage();
    expect(screen.getByRole('heading', { name: 'Кабинет' })).toBeTruthy();
  });
});
