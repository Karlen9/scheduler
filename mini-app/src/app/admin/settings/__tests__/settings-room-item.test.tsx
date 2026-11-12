import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ru from '../../../../../messages/ru.json';
import SettingsPage from '../page';

import type { TAdminScheduleContext, TRoomResponse } from '@/lib/types';

const state = vi.hoisted(() => ({
  room: { room: null } as unknown as TRoomResponse,
  context: { workingHours: [], daysOff: [] } as unknown as TAdminScheduleContext,
}));

vi.mock('@/hooks/queries', () => ({
  useAdminProfile: () => ({ data: null }),
  useAdminScheduleContext: () => ({ data: state.context }),
  useAdminRoom: () => ({ data: state.room, isLoading: false }),
}));

vi.mock('@/actions/locale', () => ({ setLocale: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { admin: {} } }));
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }): React.ReactNode => <div>{title}</div>,
}));
vi.mock('@/components/LanguageSelector', () => ({ LanguageSelector: (): null => null }));
vi.mock('@/components/ThemeSelector', () => ({ ThemeSelector: (): null => null }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/settings',
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

function renderPage(): void {
  render(
    <NextIntlClientProvider locale={'ru'} messages={ru}>
      <SettingsPage />
    </NextIntlClientProvider>,
  );
}

function roomLink(): HTMLElement {
  return screen
    .getAllByRole('link')
    .find((a) => a.getAttribute('href') === '/admin/settings/room') as HTMLElement;
}

describe('Settings menu: room item', () => {
  beforeEach(() => {
    state.room = { room: null };
    state.context = { workingHours: [], daysOff: [], scheduleMode: 'weekly' };
  });

  it('is always visible, for a solo specialist in weekly mode', () => {
    renderPage();
    expect(roomLink().textContent).toContain('Кабинет');
    expect(roomLink().textContent).toContain('Работаю один');
  });

  it('is visible in dates mode next to the work-days item', () => {
    state.context = { workingHours: [], daysOff: [], scheduleMode: 'dates' };
    renderPage();
    expect(roomLink()).toBeTruthy();
    expect(
      screen
        .getAllByRole('link')
        .some((a) => a.getAttribute('href') === '/admin/settings/work-days'),
    ).toBe(true);
  });

  it('shows the room name in a room', () => {
    state.room = { room: { id: 'r', name: 'На Ленина' }, members: [] };
    renderPage();
    expect(roomLink().textContent).toContain('На Ленина');
    expect(roomLink().textContent).not.toContain('«');
  });

  it('shows the member count for an unnamed room', () => {
    state.room = {
      room: { id: 'r', name: '' },
      members: [
        { id: 'a', name: 'A', color: 'green' },
        { id: 'b', name: 'B', color: 'pink' },
      ],
    };
    renderPage();
    expect(roomLink().textContent).toContain('2 участника');
  });
});
