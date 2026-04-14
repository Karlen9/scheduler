import { describe, expect, it } from 'vitest';

import { fetchMockAPI } from '../mock-api';

import type { TBooking, TTimeSlot } from '../types';

describe('fetchMockAPI availability', () => {
  it('uses mock working hours instead of a fixed 09:00-19:00 range', async () => {
    const slots = await fetchMockAPI<TTimeSlot[]>('/api/availability?date=2026-04-14&duration=45');

    expect(slots.at(0)).toMatchObject({ time: '10:00', endTime: '10:45' });
    expect(slots.some((slot) => slot.time === '09:00')).toBe(false);
    expect(slots.every((slot) => slot.time < '19:00')).toBe(true);
  });

  it('creates bookings using sessionTypeId before duration fallback', async () => {
    const booking = await fetchMockAPI<TBooking>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        sessionTypeId: 'mock-service-mobility',
        duration: 60,
        date: '2026-04-14',
        time: '10:00',
        name: 'Client',
      }),
    });

    expect(booking.sessionType?.id).toBe('mock-service-mobility');
    expect(booking.durationMinutes).toBe(45);
    expect(booking.endsAt).toBe('2026-04-14T10:45:00.000Z');
  });
});
