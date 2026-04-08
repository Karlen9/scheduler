import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../api';

vi.mock('../telegram', () => ({
  getInitData: () => 'mock-init-data',
  getSpecialistId: () => 'mock-specialist-id',
}));

/***************************************************************************************************
 * Defines the mock fetch value used by the shared utility layer.
 *
 * Usage context:
 * - Reused by the shared utility layer to keep shared values centralized.
 ***************************************************************************************************/
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('api.getSpecialist', () => {
  it('fetches specialist with correct URL and headers', async () => {
    /***************************************************************************************************
     * Defines the specialist data value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const specialistData = {
      id: '1',
      name: 'Test Specialist',
      timezone: 'UTC',
      cancelCutoffHours: 2,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => Promise.resolve(specialistData),
    });

    /***************************************************************************************************
     * Defines the result value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const result = await api.getSpecialist();

    expect(result).toEqual(specialistData);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/specialist');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-Telegram-Init-Data']).toBe('mock-init-data');
    expect(options.headers['X-Specialist-ID']).toBe('mock-specialist-id');
  });

  it('deduplicates concurrent GET requests', async () => {
    /***************************************************************************************************
     * Defines the specialist data value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const specialistData = {
      id: '1',
      name: 'Test Specialist',
      timezone: 'UTC',
      cancelCutoffHours: 2,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => Promise.resolve(specialistData),
    });

    const [first, second] = await Promise.all([api.getSpecialist(), api.getSpecialist()]);

    expect(first).toEqual(specialistData);
    expect(second).toEqual(specialistData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('api.createBooking', () => {
  it('sends POST request with correct body', async () => {
    /***************************************************************************************************
     * Defines the booking data value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
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
      json: async () => Promise.resolve(bookingData),
    });

    /***************************************************************************************************
     * Defines the result value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
    const result = await api.createBooking(60, '2026-06-15', '10:00', 'Client', 'Hello');

    expect(result).toEqual(bookingData);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/bookings');
    expect(options.method).toBe('POST');

    /***************************************************************************************************
     * Defines the body value used by the shared utility layer.
     *
     * Usage context:
     * - Reused by the shared utility layer to keep shared values centralized.
     ***************************************************************************************************/
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
      text: async () => Promise.resolve('Bad request'),
    });

    await expect(api.getSpecialist()).rejects.toThrow('Bad request');
  });

  it('throws with HTTP status when no error text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => Promise.resolve(''),
    });

    await expect(api.getSpecialist()).rejects.toThrow('HTTP 500');
  });
});
