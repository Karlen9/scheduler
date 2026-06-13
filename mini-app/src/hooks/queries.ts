import useSWR from 'swr';

import { api } from '@/lib/api';

import { CACHE_KEYS } from './cache-keys';

import type {
  TAdminBookingsQuery,
  TAdminBookingsResponse,
  TAdminScheduleContext,
  TAdminStats,
  TBooking,
  TBookingListResponse,
  TClientBatch,
  TClientInfo,
  TClientListQuery,
  TClientListResponse,
  TClientProfile,
  TClientStats,
  TDayOff,
  TRecurringSchedule,
  TReferralsResponse,
  TScheduleContext,
  TSessionType,
  TSpecialist,
  TSubscription,
  TWorkingHours,
} from '@/lib/types';
import type { KeyedMutator, SWRConfiguration } from 'swr';

function adminBookingsQueryKey(params: TAdminBookingsQuery): string {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  for (const status of params.statuses ?? []) {
    query.append('status', status);
  }
  if (params.dateFrom) {
    query.set('dateFrom', params.dateFrom);
  }
  if (params.dateTo) {
    query.set('dateTo', params.dateTo);
  }
  if (params.clientId) {
    query.set('clientId', params.clientId);
  }
  for (const serviceId of params.serviceIds ?? []) {
    query.append('serviceId', serviceId);
  }
  if (params.sort) {
    query.set('sort', params.sort);
  }
  return query.toString();
}

function clientBookingsQueryKey(params: { page: number; limit: number }): string {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  return query.toString();
}

function adminClientsQueryKey(params: TClientListQuery): string {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }
  return query.toString();
}

/***************************************************************************************************
 * Static data hooks (cached aggressively).
 ***************************************************************************************************/
const staticConfig: SWRConfiguration = {
  dedupingInterval: 60000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
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
  revalidateOnReconnect: false,
  revalidateIfStale: false,
};

const dynamicConfig: SWRConfiguration = {
  dedupingInterval: 30000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
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
 * Loads and exposes client analytics data for consuming components.
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
export function useClientStats(): {
  data: TClientStats | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TClientStats>;
} {
  const { data, isLoading, error, mutate } = useSWR<TClientStats>(
    CACHE_KEYS.clientStats,
    async () => api.getClientStats(),
    staticConfig,
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
  const { data, isLoading, error, mutate } = useSWR<TBooking[]>(
    CACHE_KEYS.bookings,
    async () => api.getBookings(),
    dynamicConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useBookingsPage(params: { page: number; limit: number }): {
  data: TBookingListResponse;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TBookingListResponse>;
} {
  const queryKey = clientBookingsQueryKey(params);
  const { data, isLoading, error, mutate } = useSWR<TBookingListResponse>(
    CACHE_KEYS.bookingsList(queryKey),
    async () => api.getBookingsPage(params),
    dynamicConfig,
  );
  return {
    data: data ?? {
      bookings: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 0,
    },
    isLoading,
    error,
    mutate,
  };
}

export function useClientBatches(): {
  data: TClientBatch[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TClientBatch[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TClientBatch[]>(
    CACHE_KEYS.clientBatches,
    async () => api.getClientBatches(),
    dynamicConfig,
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
    {
      ...dynamicConfig,
      refreshInterval: opts?.refreshInterval,
      refreshWhenHidden: false,
    },
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useAdminBookingsPage(
  params: TAdminBookingsQuery,
  opts?: { refreshInterval?: number },
): {
  data: TAdminBookingsResponse;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TAdminBookingsResponse>;
} {
  const queryKey = adminBookingsQueryKey(params);
  const { data, isLoading, error, mutate } = useSWR<TAdminBookingsResponse>(
    CACHE_KEYS.adminBookingsList(queryKey),
    async () => api.admin.getBookingsPage(params),
    {
      ...dynamicConfig,
      refreshInterval: opts?.refreshInterval,
      refreshWhenHidden: false,
    },
  );
  return {
    data: data ?? {
      bookings: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 0,
    },
    isLoading,
    error,
    mutate,
  };
}

export function useAdminClientsPage(params: TClientListQuery): {
  data: TClientListResponse;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TClientListResponse>;
} {
  const queryKey = adminClientsQueryKey(params);
  const { data, isLoading, error, mutate } = useSWR<TClientListResponse>(
    CACHE_KEYS.adminClientsList(queryKey),
    async () => api.admin.getClientsPage(params),
    userConfig,
  );
  return {
    data: data ?? {
      clients: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 0,
      searchQuery: params.search?.trim() ?? '',
    },
    isLoading,
    error,
    mutate,
  };
}

/***************************************************************************************************
 * Loads and exposes admin analytics data for consuming components.
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
export function useAdminStats(): {
  data: TAdminStats | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TAdminStats>;
} {
  const { data, isLoading, error, mutate } = useSWR<TAdminStats>(
    CACHE_KEYS.adminStats,
    async () => api.admin.getAdminStats(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
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
    dynamicConfig,
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
    dynamicConfig,
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
    dynamicConfig,
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
    dynamicConfig,
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

export function useAdminClientBatches(clientId?: string): {
  data: TClientBatch[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TClientBatch[]>;
} {
  const { data, isLoading, error, mutate } = useSWR<TClientBatch[]>(
    clientId ? CACHE_KEYS.adminClientBatches(clientId) : null,
    async () => api.admin.getClientBatches(clientId!),
    dynamicConfig,
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
/***************************************************************************************************
 * Loads referral stats + list of referred clients for the current specialist.
 ***************************************************************************************************/
export function useAdminReferrals(): {
  data: TReferralsResponse | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TReferralsResponse>;
} {
  const { data, isLoading, error, mutate } = useSWR<TReferralsResponse>(
    CACHE_KEYS.adminReferrals,
    async () => api.admin.getReferrals(),
    userConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

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

/***************************************************************************************************
 * Loads and exposes subscription status + available plans for consuming components.
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
export function useSubscription(): {
  data: TSubscription | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<TSubscription>;
} {
  const { data, isLoading, error, mutate } = useSWR<TSubscription>(
    CACHE_KEYS.adminSubscription,
    async () => api.admin.getSubscription(),
    userConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}
