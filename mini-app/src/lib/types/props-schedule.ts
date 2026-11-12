import type {
  TBooking,
  TClientBatch,
  TClientInfo,
  TRecurringSchedule,
  TSessionType,
  TWorkingHours,
} from './domain';
import type { TVoidFunction } from './shared';
import type { Dispatch, SetStateAction } from 'react';

export type TDaySchedule = {
  enabled: boolean;
  intervals: { startTime: string; endTime: string }[];
};

export type TViewMode = 'day' | 'week' | 'month';

export type TEmptySlot = {
  startMin: number;
  endMin: number;
  kind?: 'available' | 'break';
};

export type TAdminScheduleInfoCardProps = {
  schedule: TRecurringSchedule;
  scheduleStatus: { color: string; border: string };
  title: string;
  statusLabel: string;
  daysLabel: string;
  serviceName: string;
  dateRange: string | null;
  durationLabel: string;
  dayTimes: Record<string, string> | null;
};

export type TClientScheduleInfoCardProps = {
  schedule: TRecurringSchedule;
  scheduleStatus: { color: string; border: string };
  scheduleStatusLabel: string;
  serviceName: string;
  daysLabel: string;
  dateRange: string | null;
  durationLabel: string;
  dayTimes: Record<string, string> | null;
};

export type TCalendarViewProps = {
  selectedDate: Date | null;
  selectedDates?: Date[];
  onSelectDate: (date: Date) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  /** Dates mode: when set, every date outside the set is closed. */
  openDates?: Set<string>;
  bookedDates?: string[];
  disabledDates?: string[];
  /** Month shown first; defaults to the current month. */
  initialMonth?: Date;
};

export type TCurrentTimeIndicatorProps = {
  top: number;
};

export type TDayTimelineProps = {
  bookings: TBooking[];
  date: Date;
  onBookingClick?: (booking: TBooking) => void;
  workingHours?: TWorkingHours[];
  serviceDurations?: number[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

export type TMonthGridProps = {
  displayDate: Date;
  selectedDate: Date | null;
  selectedDates?: Date[];
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: TVoidFunction;
  onNextMonth: TVoidFunction;
  nonWorkingDays?: number[];
  daysOff?: string[];
  /** Dates mode: when set, every date outside the set is non-working. */
  openDates?: Set<string>;
  disablePast?: boolean;
  disabledDates?: Set<string>;
  dotDates?: Set<string>;
  /** Dates that get a small dot under the number (e.g. days that already have bookings). */
  markedDates?: Set<string>;
  /** Date -> CSS colour: fills the day with that colour (room owner colours). */
  dayColors?: Map<string, string>;
  bookedDates?: Set<string>;
  fillOuterDays?: boolean;
  card?: boolean;
  showLegend?: boolean;
  onTitleClick?: TVoidFunction;
  disableNonWorking?: boolean;
  maxDate?: Date;
};

export type TNextBookingBannerProps = {
  booking: TBooking | null;
  onBookingClick?: (booking: TBooking) => void;
};

export type TScheduleViewProps = {
  bookings: TBooking[];
  onBookingClick?: (booking: TBooking) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  openDates?: Set<string>;
  workingHours?: TWorkingHours[];
  /** Dates mode: resolves the hours of a specific date (overrides `workingHours`). */
  getWorkingHoursForDate?: (date: Date) => TWorkingHours[];
  serviceDurations?: number[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

export type TTimelineBookingCardProps = {
  booking: TBooking;
  top: number;
  height: number;
  onBookingClick?: (booking: TBooking) => void;
  formatTime: (iso: string) => string;
};

export type TTimelineEmptySlotProps = {
  slot: TEmptySlot;
  date: Date;
  top: number;
  height: number;
  collapsed?: boolean;
  listMode?: boolean;
  serviceDurations?: number[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

export type TWeekStripProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: TVoidFunction;
  onNextWeek: TVoidFunction;
  nonWorkingDays?: number[];
  daysOff?: string[];
  openDates?: Set<string>;
  dotDates?: Set<string>;
};

export type TClientSelectorProps = {
  clients?: TClientInfo[];
  selectedClient: TClientInfo | null;
  onCreateGhostClient: ((name: string) => Promise<TClientInfo>) | undefined;
  setSelectedClient: Dispatch<SetStateAction<TClientInfo | null>>;
};

export type TPinnedBottomButtonProps = {
  mode: 'single' | 'multi';
  selectedDates: Date[];
  timeAssignments: Record<string, string>;
  selectedService: TSessionType | null;
  handleChipTap: (date: Date) => void;
  handleOnetimeSubmit: TVoidFunction;
  activeDateISO: string | null;
  onetimeButtonDisabled: boolean;
  onetimeButtonText: string;
  readOnly?: boolean;
  readOnlyActionLabel?: string;
};

export type TServiceCardProps = {
  service: TSessionType;
  onEdit?: TVoidFunction;
  onDelete?: TVoidFunction;
  onClick?: TVoidFunction;
  clickLabel?: string;
  clientBatch?: TClientBatch | null;
};

export type TTimeSlotGridProps = {
  slots: {
    time: string;
    endTime?: string;
    available: boolean;
    mine?: boolean;
    current?: boolean;
  }[];
  selected: string | null;
  onSelect: (time: string) => void;
  /** Caption under the time of the `current` slot (the booking being rescheduled). */
  currentLabel?: string;
};
