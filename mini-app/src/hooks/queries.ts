import useSWR, { SWRConfiguration } from "swr";
import { api } from "@/lib/api";
import { CACHE_KEYS } from "./cache-keys";
import type {
  Trainer,
  SessionType,
  WorkingHours,
  ClientProfile,
  Booking,
  DayOff,
  RecurringSchedule,
  ClientInfo,
} from "@/lib/types";

// ========== Static data hooks (cached aggressively) ==========

const staticConfig: SWRConfiguration = { dedupingInterval: 60000 };

export function useTrainer() {
  const { data, isLoading, error, mutate } = useSWR<Trainer>(
    CACHE_KEYS.trainer,
    () => api.getTrainer(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

export function useWorkingHours() {
  const { data, isLoading, error, mutate } = useSWR<WorkingHours[]>(
    CACHE_KEYS.workingHours,
    () => api.getWorkingHours(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useDaysOff() {
  const { data, isLoading, error, mutate } = useSWR<{ date: string }[]>(
    CACHE_KEYS.daysOff,
    () => api.getDaysOff(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useDurations() {
  const { data, isLoading, error, mutate } = useSWR<number[]>(
    CACHE_KEYS.durations,
    () => api.getDurations(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useSessionTypes() {
  const { data, isLoading, error, mutate } = useSWR<SessionType[]>(
    CACHE_KEYS.sessionTypes,
    () => api.getSessionTypes(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

// ========== User data hooks (moderate caching) ==========

const userConfig: SWRConfiguration = { dedupingInterval: 30000 };

export function useProfile() {
  const { data, isLoading, error, mutate } = useSWR<ClientProfile>(
    CACHE_KEYS.profile,
    () => api.getProfile(),
    userConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

export function useClients() {
  const { data, isLoading, error, mutate } = useSWR<ClientInfo[]>(
    CACHE_KEYS.adminClients,
    () => api.admin.getClients(),
    userConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

// ========== Dynamic data hooks ==========

export function useBookings() {
  const { data, isLoading, error, mutate } = useSWR<Booking[]>(
    CACHE_KEYS.bookings,
    () => api.getBookings(),
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useAdminBookings(opts?: { refreshInterval?: number }) {
  const { data, isLoading, error, mutate } = useSWR<Booking[]>(
    CACHE_KEYS.adminBookings,
    () => api.admin.getBookings(),
    { refreshInterval: opts?.refreshInterval },
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useRecurringSchedules() {
  const { data, isLoading, error, mutate } = useSWR<RecurringSchedule[]>(
    CACHE_KEYS.recurringSchedules,
    () => api.getRecurringSchedules(),
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useRecurringDetail(id: string) {
  const { data, isLoading, error, mutate } = useSWR<RecurringSchedule>(
    id ? CACHE_KEYS.recurringDetail(id) : null,
    () => api.getRecurringScheduleDetail(id),
  );
  return { data: data ?? null, isLoading, error, mutate };
}

export function useAdminRecurringSchedules() {
  const { data, isLoading, error, mutate } = useSWR<RecurringSchedule[]>(
    CACHE_KEYS.adminRecurringSchedules,
    () => api.admin.getRecurringSchedules(),
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useAdminRecurringDetail(id: string) {
  const { data, isLoading, error, mutate } = useSWR<RecurringSchedule>(
    id ? CACHE_KEYS.adminRecurringDetail(id) : null,
    () => api.admin.getRecurringScheduleDetail(id),
  );
  return { data: data ?? null, isLoading, error, mutate };
}

// ========== Admin settings hooks ==========

export function useAdminWorkingHours() {
  const { data, isLoading, error, mutate } = useSWR<WorkingHours[]>(
    CACHE_KEYS.adminWorkingHours,
    () => api.admin.getWorkingHours(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useAdminDaysOff() {
  const { data, isLoading, error, mutate } = useSWR<DayOff[]>(
    CACHE_KEYS.adminDaysOff,
    () => api.admin.getDaysOff(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useAdminServices() {
  const { data, isLoading, error, mutate } = useSWR<SessionType[]>(
    CACHE_KEYS.adminServices,
    () => api.admin.getServices(),
    staticConfig,
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useAdminProfile() {
  const { data, isLoading, error, mutate } = useSWR<Trainer>(
    CACHE_KEYS.adminProfile,
    () => api.admin.getProfile(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}

export function useAdminNotifications() {
  const { data, isLoading, error, mutate } = useSWR<{
    notifyNewBookings: boolean;
    notifyCancellations: boolean;
  }>(
    CACHE_KEYS.adminNotifications,
    () => api.admin.getNotificationPrefs(),
    staticConfig,
  );
  return { data: data ?? null, isLoading, error, mutate };
}
