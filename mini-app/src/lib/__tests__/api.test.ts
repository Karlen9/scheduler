import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../telegram', () => ({
  getInitData: () => 'mock-init-data',
  getSpecialistId: () => 'mock-specialist-id',
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { api } from '../api';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('api.getSpecialist', () => {
  it('fetches specialist with correct URL and headers', async () => {
    const specialistData = {
      id: '1',
      name: 'Test Specialist',
      timezone: 'UTC',
      cancelCutoffHours: 2,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(specialistData),
    });

    const result = await api.getSpecialist();

    expect(result).toEqual(specialistData);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/trainer');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-Telegram-Init-Data']).toBe('mock-init-data');
    expect(options.headers['X-Specialist-ID']).toBe('mock-specialist-id');
  });
});

describe('api.createBooking', () => {
  it('sends POST request with correct body', async () => {
    const bookingData = {
      id: 'b1',
      startsAt: '2026-06-15T10:00:00Z',
      endsAt: '2026-06-15T11:00:00Z',
      clientName: 'Client',
      status: 'pending',
      durationMinutes: 60,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(bookingData),
    });

    const result = await api.createBooking(60, '2026-06-15', '10:00', 'Client', 'Hello');

    expect(result).toEqual(bookingData);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/bookings');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body).toEqual({
      duration: 60,
      date: '2026-06-15',
      time: '10:00',
      name: 'Client',
      message: 'Hello',
    });
  });
});

describe('error handling', () => {
  it('throws on non-ok response with error text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request'),
    });

    await expect(api.getSpecialist()).rejects.toThrow('Bad request');
  });

  it('throws with HTTP status when no error text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve(''),
    });

    await expect(api.getSpecialist()).rejects.toThrow('HTTP 500');
  });
});
