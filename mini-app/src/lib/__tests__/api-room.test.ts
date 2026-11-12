import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api';
import { ApiError, RoomError } from '../api-error';

vi.mock('../telegram', () => ({
  getInitData: () => 'init',
  getSpecialistId: () => 'spec-1',
  waitForInitData: async () => Promise.resolve('init'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function ok(body: unknown): unknown {
  return { ok: true, status: 200, json: async () => Promise.resolve(body) };
}

function fail(status: number, text: string): unknown {
  return { ok: false, status, text: async () => Promise.resolve(text) };
}

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [
    string,
    RequestInit,
  ];
  return {
    url,
    method: init.method ?? 'GET',
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('room API calls', () => {
  it('GET /api/admin/room', async () => {
    mockFetch.mockResolvedValueOnce(ok({ room: null }));
    expect(await api.admin.getRoom()).toEqual({ room: null });
    expect(lastCall()).toMatchObject({ url: '/api/admin/room', method: 'GET' });
  });

  it('creates and renames a room', async () => {
    mockFetch.mockResolvedValue(ok({ room: { id: 'r', name: 'X' } }));
    await api.admin.createRoom('X');
    expect(lastCall()).toEqual({ url: '/api/admin/room', method: 'POST', body: { name: 'X' } });
    await api.admin.updateRoom('Y');
    expect(lastCall()).toEqual({ url: '/api/admin/room', method: 'PUT', body: { name: 'Y' } });
  });

  it('adds a member with or without an invite', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        member: { id: 'm1', name: 'Аня', color: 'violet' },
        inviteLink: 'https://t.me/x?start=room_1',
      }),
    );
    const result = await api.admin.addRoomMember({ name: 'Аня', color: 'violet', invite: true });
    expect(lastCall()).toEqual({
      url: '/api/admin/room/members',
      method: 'POST',
      body: { name: 'Аня', color: 'violet', invite: true },
    });
    expect(result.inviteLink).toBe('https://t.me/x?start=room_1');
  });

  it('updates, invites and deletes a member', async () => {
    mockFetch.mockResolvedValue(ok({}));
    await api.admin.updateRoomMember('m1', { color: 'pink' });
    expect(lastCall()).toEqual({
      url: '/api/admin/room/members/m1',
      method: 'PUT',
      body: { color: 'pink' },
    });
    await api.admin.createRoomMemberInvite('m1');
    expect(lastCall()).toMatchObject({ url: '/api/admin/room/members/m1/invite', method: 'POST' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
    await api.admin.deleteRoomMember('m1');
    expect(lastCall()).toMatchObject({ url: '/api/admin/room/members/m1', method: 'DELETE' });
  });

  it('PUTs day assignments', async () => {
    mockFetch.mockResolvedValueOnce(ok({ room: { id: 'r', name: '' } }));
    await api.admin.updateRoomDays([
      { date: '2026-11-20', memberId: 'm1' },
      { date: '2026-11-21', memberId: '' },
    ]);
    expect(lastCall()).toEqual({
      url: '/api/admin/room/days',
      method: 'PUT',
      body: {
        assign: [
          { date: '2026-11-20', memberId: 'm1' },
          { date: '2026-11-21', memberId: '' },
        ],
      },
    });
  });

  it('creates, accepts, declines and cancels day requests', async () => {
    mockFetch.mockResolvedValue(ok({}));
    await api.admin.createRoomRequest('2026-11-20');
    expect(lastCall()).toEqual({
      url: '/api/admin/room/requests',
      method: 'POST',
      body: { date: '2026-11-20' },
    });
    await api.admin.acceptRoomRequest('q1');
    expect(lastCall()).toMatchObject({ url: '/api/admin/room/requests/q1/accept', method: 'POST' });
    await api.admin.declineRoomRequest('q1');
    expect(lastCall()).toMatchObject({
      url: '/api/admin/room/requests/q1/decline',
      method: 'POST',
    });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
    await api.admin.cancelRoomRequest('q1');
    expect(lastCall()).toMatchObject({ url: '/api/admin/room/requests/q1', method: 'DELETE' });
  });
});

describe('room errors', () => {
  it('turns a 409 into a RoomError carrying the dates, code and message', async () => {
    mockFetch.mockResolvedValueOnce(
      fail(
        409,
        JSON.stringify({
          error: 'Error.RoomDayNotYours',
          message: 'Day belongs to a colleague',
          dates: ['2026-11-20'],
        }),
      ),
    );
    const error = await api.admin
      .updateRoomDays([{ date: '2026-11-20', memberId: 'me' }])
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RoomError);
    expect((error as RoomError).status).toBe(409);
    expect((error as RoomError).dates).toEqual(['2026-11-20']);
    expect((error as RoomError).code).toBe('Error.RoomDayNotYours');
    expect((error as RoomError).message).toBe('Day belongs to a colleague');
  });

  it('turns a 403 into a RoomError and tolerates non-JSON bodies', async () => {
    mockFetch.mockResolvedValueOnce(fail(403, 'forbidden'));
    const error = await api.admin.deleteRoomMember('m2').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RoomError);
    expect((error as RoomError).status).toBe(403);
    expect((error as RoomError).dates).toEqual([]);
  });

  it('leaves other failures as plain ApiErrors', async () => {
    mockFetch.mockResolvedValueOnce(fail(500, 'boom'));
    const error = await api.admin.createRoom('X').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(RoomError);
  });
});
