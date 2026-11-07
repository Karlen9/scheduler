import { act, render, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';

import { invalidateChangeGroups } from '../mutations';
import { useScheduleContext } from '../queries';

import type { TScheduleContext } from '@/lib/types';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', () => ({
  api: {
    getScheduleContext: vi.fn(),
  },
}));

function context(dayOfWeek: number): TScheduleContext {
  return {
    workingHours: [{ id: `wh-${dayOfWeek}`, dayOfWeek, startTime: '09:00', endTime: '18:00' }],
    daysOff: [],
  } as unknown as TScheduleContext;
}

/***************************************************************************************************
 * Mirrors the real app: one long-lived SWRConfig (the provider) with pages mounting and
 * unmounting underneath it. The tests share SWR's default cache (invalidateChangeGroups uses the
 * global mutate), so they are written to be order-independent via call-count baselines.
 ***************************************************************************************************/
function Consumer({ onData }: { onData: (day: number | undefined) => void }): null {
  const { data } = useScheduleContext();
  onData(data?.workingHours[0]?.dayOfWeek);
  return null;
}

function App({
  showPage,
  onData,
}: {
  showPage: boolean;
  onData: (day: number | undefined) => void;
}): ReactNode {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: true,
        dedupingInterval: 60000,
      }}
    >
      {showPage ? <Consumer onData={onData} /> : null}
    </SWRConfig>
  );
}

const GetScheduleContext = vi.mocked(api.getScheduleContext);

describe('SWR invalidation of hooks that mount later', () => {
  it('does not refetch on a plain remount inside the dedupe interval', async () => {
    GetScheduleContext.mockResolvedValue(context(1));

    let latest: number | undefined;
    const onData = (day: number | undefined): void => {
      latest = day;
    };

    const view = render(<App showPage onData={onData} />);
    await waitFor(() => expect(latest).toBe(1));
    const callsAfterFirstMount = GetScheduleContext.mock.calls.length;
    expect(callsAfterFirstMount).toBe(1);

    view.rerender(<App showPage={false} onData={onData} />);
    view.rerender(<App showPage onData={onData} />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(GetScheduleContext.mock.calls.length).toBe(callsAfterFirstMount);
    view.unmount();
  });

  it('refetches on a later mount after the workingHours group was invalidated while unmounted', async () => {
    // Stale cache from the previous test: Sunday (0) is NOT a working day.
    let latest: number | undefined;
    const onData = (day: number | undefined): void => {
      latest = day;
    };

    const view = render(<App showPage onData={onData} />);
    await waitFor(() => expect(latest).toBe(1));
    view.rerender(<App showPage={false} onData={onData} />);

    // The specialist makes Sunday a working day and saves while no booking hook is mounted.
    GetScheduleContext.mockResolvedValue(context(0));
    const callsBeforeInvalidation = GetScheduleContext.mock.calls.length;
    await act(async () => {
      await invalidateChangeGroups(['workingHours']);
    });

    // Opening the booking page afterwards must refetch instead of trusting the stale cache.
    view.rerender(<App showPage onData={onData} />);
    await waitFor(() =>
      expect(GetScheduleContext.mock.calls.length).toBeGreaterThan(callsBeforeInvalidation),
    );
    await waitFor(() => expect(latest).toBe(0));
    view.unmount();
  });
});
