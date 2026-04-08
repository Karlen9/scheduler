import useSWR from 'swr';

import { api } from '@/lib/api';

import { CACHE_KEYS } from './cache-keys';

import type {
  TAdminScheduleContext,
  TBooking,
  TClientInfo,
  TClientProfile,
  TDayOff,
  TRecurringSchedule,
  TScheduleContext,
  TSessionType,
  TSpecialist,
  TWorkingHours,
} from '@/lib/types';
import type { KeyedMutator, SWRConfiguration } from 'swr';

/***************************************************************************************************
 * Static data hooks (cached aggressively).
 ***************************************************************************************************/
const staticConfig: SWRConfiguration = {
  dedupingInterval: 60000,
  revalidateOnFocus: false,
  revalidateIfStale: false,
};

/***************************************************************************************************
 * Loads and exposes specialist data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useSpecialist(): {
  data: TSpecialist | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TSpecialist>;
} {
  const { data, isLoading, error, mutate } = useSWR<TSpecialist>(
    CACHE_KEYS.specialist,
    async () => api.getSpecialist(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes working hours data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useWorkingHours(): {
  data: TWorkingHours[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TWorkingHours[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TWorkingHours[]>(
    CACHE_KEYS.workingHours,
    async () => api.getWorkingHours(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes schedule context data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useScheduleContext(): {
  data: TScheduleContext | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TScheduleContext>;
} {
  const { data, isLoading, error, mutate } = useSWR<TScheduleContext>(
    CACHE_KEYS.scheduleContext,
    async () => api.getScheduleContext(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes days off data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useDaysOff(): {
  data: { date: string }[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<{ date: string }[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<{ date: string }[]>(
    CACHE_KEYS.daysOff,
    async () => api.getDaysOff(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes session types data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useSessionTypes(): {
  data: TSessionType[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TSessionType[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TSessionType[]>(
    CACHE_KEYS.sessionTypes,
    async () => api.getSessionTypes(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * User data hooks (moderate caching).
 ***************************************************************************************************/
const userConfig: SWRConfiguration = {
  dedupingInterval: 30000,
  revalidateOnFocus: false,
};

/***************************************************************************************************
 * Loads and exposes profile data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useProfile(): {
  data: TClientProfile | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TClientProfile>;
} {
  const { data, isLoading, error, mutate } = useSWR<TClientProfile>(
    CACHE_KEYS.profile,
    async () => api.getProfile(),
    userConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes clients data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useClients(): {
  data: TClientInfo[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TClientInfo[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TClientInfo[]>(
    CACHE_KEYS.adminClients,
    async () => api.admin.getClients(),
    userConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Dynamic data hooks.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useBookings(): {
  data: TBooking[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TBooking[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TBooking[]>(CACHE_KEYS.bookings, async () =>
    api.getBookings(),
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin bookings data for consuming components.
 *
 * Parameters:
 * - opts: Opts used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminBookings(opts?: { refreshInterval?: number }): {
  data: TBooking[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TBooking[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TBooking[]>(
    CACHE_KEYS.adminBookings,
    async () => api.admin.getBookings(),
    { refreshInterval: opts?.refreshInterval },
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes recurring schedules data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useRecurringSchedules(): {
  data: TRecurringSchedule[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TRecurringSchedule[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TRecurringSchedule[]>(
    CACHE_KEYS.recurringSchedules,
    async () => api.getRecurringSchedules(),
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes recurring detail data for consuming components.
 *
 * Parameters:
 * - id: Identifier used to target the current record.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useRecurringDetail(id: string): {
  data: TRecurringSchedule | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TRecurringSchedule>;
} {
  const { data, isLoading, error, mutate } = useSWR<TRecurringSchedule>(
    id ? CACHE_KEYS.recurringDetail(id) : null,
    async () => api.getRecurringScheduleDetail(id),
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin recurring schedules data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminRecurringSchedules(): {
  data: TRecurringSchedule[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TRecurringSchedule[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TRecurringSchedule[]>(
    CACHE_KEYS.adminRecurringSchedules,
    async () => api.admin.getRecurringSchedules(),
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin recurring detail data for consuming components.
 *
 * Parameters:
 * - id: Identifier used to target the current record.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminRecurringDetail(id: string): {
  data: TRecurringSchedule | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TRecurringSchedule>;
} {
  const { data, isLoading, error, mutate } = useSWR<TRecurringSchedule>(
    id ? CACHE_KEYS.adminRecurringDetail(id) : null,
    async () => api.admin.getRecurringScheduleDetail(id),
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Admin settings hooks.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminWorkingHours(): {
  data: TWorkingHours[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TWorkingHours[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TWorkingHours[]>(
    CACHE_KEYS.adminWorkingHours,
    async () => api.admin.getWorkingHours(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin schedule context data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminScheduleContext(): {
  data: TAdminScheduleContext | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TAdminScheduleContext>;
} {
  const { data, isLoading, error, mutate } = useSWR<TAdminScheduleContext>(
    CACHE_KEYS.adminScheduleContext,
    async () => api.admin.getScheduleContext(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin days off data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminDaysOff(): {
  data: TDayOff[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TDayOff[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TDayOff[]>(
    CACHE_KEYS.adminDaysOff,
    async () => api.admin.getDaysOff(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin services data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminServices(): {
  data: TSessionType[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TSessionType[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TSessionType[]>(
    CACHE_KEYS.adminServices,
    async () => api.admin.getServices(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin profile data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminProfile(): {
  data: TSpecialist | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TSpecialist>;
} {
  const { data, isLoading, error, mutate } = useSWR<TSpecialist>(
    CACHE_KEYS.adminProfile,
    async () => api.admin.getProfile(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

/***************************************************************************************************
 * Loads and exposes admin notifications data for consuming components.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as .
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function useAdminNotifications(): {
  data: { notifyNewBookings: boolean; notifyCancellations: boolean } | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<{ notifyNewBookings: boolean; notifyCancellations: boolean }>;
} {
  const { data, isLoading, error, mutate } = useSWR<{
    notifyNewBookings: boolean;
    notifyCancellations: boolean;
  }>(CACHE_KEYS.adminNotifications, async () => api.admin.getNotificationPrefs(), staticConfig);
  return { data: data ?? null, isLoading, error, mutate };
}
