import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';
import { formatDateISO } from '@/lib/helpers';

import { useOnetimeBooking } from '../useOnetimeBooking';

import type { TSessionType } from '@/lib/types';

const { mockReplace, mockPush } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/book',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  vi.mocked(api.getAvailableSlots).mockReset();
  vi.mocked(api.getAvailableSlots).mockResolvedValue([]);
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/mutations', () => ({
  invalidateBookings: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getAvailableSlots: vi.fn().mockResolvedValue([]) },
}));

const makeService = (id: string, minutes = 60): TSessionType =>
  ({
    id,
    type: 'service',
    name: `Service ${id}`,
    durationMinutes: minutes,
    price: 0,
    currency: 'RUB',
  }) satisfies TSessionType;

describe('useOnetimeBooking initialService', () => {
  it('preselects a service when initialService is provided', () => {
    const services = [makeService('a'), makeService('b')];
    const { result } = renderHook(() =>
      useOnetimeBooking({
        services,
        bookedDates: [],
        selectedClient: null,
        hasClientSelector: false,
        onCreateBooking: vi.fn(),
        successRedirect: '/bookings',
        initialService: services[1],
      }),
    );

    expect(result.current.selectedService?.id).toBe('b');
  });

  it('does not re-apply initialService after the user edits the service', () => {
    const services = [makeService('a'), makeService('b')];
    const { result, rerender } = renderHook(
      (props: { initialService?: TSessionType }) =>
        useOnetimeBooking({
          services,
          bookedDates: [],
          selectedClient: null,
          hasClientSelector: false,
          onCreateBooking: vi.fn(),
          successRedirect: '/bookings',
          initialService: props.initialService,
        }),
      { initialProps: { initialService: services[1] } },
    );

    expect(result.current.selectedService?.id).toBe('b');

    act(() => {
      result.current.handleEditService();
    });
    expect(result.current.selectedService).toBeNull();

    rerender({ initialService: services[1] });
    expect(result.current.selectedService).toBeNull();
  });

  it('re-applies when a new initialService is passed after the user edited', () => {
    const services = [makeService('a'), makeService('b')];
    const { result, rerender } = renderHook(
      (props: { initialService?: TSessionType }) =>
        useOnetimeBooking({
          services,
          bookedDates: [],
          selectedClient: null,
          hasClientSelector: false,
          onCreateBooking: vi.fn(),
          successRedirect: '/bookings',
          initialService: props.initialService,
        }),
      { initialProps: { initialService: services[1] } },
    );

    expect(result.current.selectedService?.id).toBe('b');

    act(() => {
      result.current.handleEditService();
    });
    expect(result.current.selectedService).toBeNull();

    rerender({ initialService: services[0] });
    expect(result.current.selectedService?.id).toBe('a');
  });

  it('disables today when the selected service has no available slots left today', async () => {
    const services = [makeService('a')];
    const todayISO = formatDateISO(new Date());
    const { result } = renderHook(() =>
      useOnetimeBooking({
        services,
        bookedDates: [],
        selectedClient: null,
        hasClientSelector: false,
        onCreateBooking: vi.fn(),
        successRedirect: '/bookings',
        initialService: services[0],
      }),
    );

    await waitFor(() => {
      expect(result.current.disabledDates).toEqual([todayISO]);
    });
    expect(api.getAvailableSlots).toHaveBeenCalledWith(todayISO, services[0].durationMinutes);
  });
});

describe('useOnetimeBooking URL sync', () => {
  it('writes the picked service to the URL via router.replace', () => {
    const services = [makeService('a'), makeService('b')];
    const { result } = renderHook(() =>
      useOnetimeBooking({
        services,
        bookedDates: [],
        selectedClient: null,
        hasClientSelector: false,
        onCreateBooking: vi.fn(),
        successRedirect: '/bookings',
      }),
    );

    act(() => {
      result.current.handleServiceSelect(services[1]);
    });

    expect(mockReplace).toHaveBeenCalled();
    const [url] = mockReplace.mock.calls.at(-1)!;
    expect(url).toContain('service=b');
  });

  it('writes service+date on date pick, preserving service', () => {
    const services = [makeService('a')];
    const { result } = renderHook(() =>
      useOnetimeBooking({
        services,
        bookedDates: [],
        selectedClient: null,
        hasClientSelector: false,
        onCreateBooking: vi.fn(),
        successRedirect: '/bookings',
        initialService: services[0],
      }),
    );

    act(() => {
      result.current.handleSingleDateSelect(new Date(2026, 3, 22));
    });

    const [url] = mockReplace.mock.calls.at(-1)!;
    expect(url).toContain('service=a');
    expect(url).toContain('date=2026-04-22');
  });

  it('clears date/time from URL when service is changed to a different service', () => {
    const services = [makeService('a'), makeService('b')];
    const { result } = renderHook(() =>
      useOnetimeBooking({
        services,
        bookedDates: [],
        selectedClient: null,
        hasClientSelector: false,
        onCreateBooking: vi.fn(),
        successRedirect: '/bookings',
      }),
    );

    act(() => {
      result.current.handleServiceSelect(services[0]);
    });
    act(() => {
      result.current.handleServiceSelect(services[1]);
    });

    const [url] = mockReplace.mock.calls.at(-1)!;
    expect(url).toContain('service=b');
    expect(url).not.toContain('date=');
    expect(url).not.toContain('time=');
  });
});
