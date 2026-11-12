import { render, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';

import { useAdminRoom } from '../queries';

import type { TRoomResponse } from '@/lib/types';

vi.mock('@/lib/api', () => ({ api: { admin: { getRoom: vi.fn() } } }));

const getRoom = vi.mocked(api.admin.getRoom);

function Probe({ onData }: { onData: (data: TRoomResponse, loading: boolean) => void }): null {
  const { data, isLoading } = useAdminRoom();
  onData(data, isLoading);
  return null;
}

function renderProbe(onData: (data: TRoomResponse, loading: boolean) => void): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Probe onData={onData} />
    </SWRConfig>,
  );
}

describe('useAdminRoom', () => {
  it('treats a failing request as solo mode', async () => {
    getRoom.mockRejectedValue(new Error('404'));
    let latest: TRoomResponse | null = null;
    let loading = true;
    renderProbe((data, isLoading) => {
      latest = data;
      loading = isLoading;
    });

    await waitFor(() => expect(loading).toBe(false));
    expect(latest).toEqual({ room: null });
  });

  it('passes a room through and tolerates {room: null}', async () => {
    getRoom.mockResolvedValue({ room: { id: 'r', name: 'X' }, members: [] });
    let latest: TRoomResponse | null = null;
    renderProbe((data) => {
      latest = data;
    });
    await waitFor(() => expect(latest?.room?.id).toBe('r'));
  });
});
