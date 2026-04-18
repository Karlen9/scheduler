import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useOnetimeBooking } from '../useOnetimeBooking';

import type { TSessionType } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/book',
}));

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
});
