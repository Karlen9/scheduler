import type { TBooking, TBookingListResponse } from './domain';

export type TCreateBookingParams = {
  clientId?: string;
  sessionTypeId?: string;
  duration: number;
  date: string;
  time: string;
  message?: string;
};

export type TAdminBookingsSort = 'created_desc' | 'starts_at_asc' | 'starts_at_desc' | 'status_asc';

export type TAdminBookingsQuery = {
  page: number;
  limit: number;
  statuses?: TBooking['status'][];
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  serviceIds?: string[];
  sort?: TAdminBookingsSort;
};

export type TAdminBookingsResponse = TBookingListResponse;

export type TCreateRecurringParams = {
  clientId?: string;
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
};

export type TPreviewRecurringParams = {
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
};
