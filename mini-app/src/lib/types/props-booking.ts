import type { TCreateBookingParams, TCreateRecurringParams, TPreviewRecurringParams } from './api';
import type {
  TBooking,
  TClientBatch,
  TClientInfo,
  TRecurringSchedule,
  TSessionType,
  TTimeSlot,
  TWorkingHours,
} from './domain';
import type { TTranslateFunction, TVoidFunction } from './shared';
import type { Dispatch, SetStateAction } from 'react';

export type TBookingCardItemProps = {
  booking: TBooking;
  onRequestCancel: (booking: TBooking) => void;
  formatBookingDate: (iso: string) => string;
  onApproveReschedule?: (booking: TBooking) => void | Promise<void>;
  onDeclineReschedule?: (booking: TBooking) => void | Promise<void>;
  rescheduleBusy?: boolean;
  replacedBooking?: TBooking;
};

export type TBookingCardProps = {
  booking: TBooking;
  onCancel?: (booking: TBooking) => void;
  onConfirm?: (booking: TBooking) => void;
  onDecline?: (booking: TBooking) => void;
  onApproveReschedule?: (booking: TBooking) => void;
  onDeclineReschedule?: (booking: TBooking) => void;
  replacedBooking?: TBooking;
};

export type TBookingDetailModalProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onReschedule?: (booking: TBooking) => void;
  onCancel?: (booking: TBooking) => void;
  onAccept?: (booking: TBooking) => void;
  onReject?: (booking: TBooking) => void;
  onMessageClient?: (booking: TBooking) => void;
  onApproveReschedule?: (booking: TBooking) => void;
  onDeclineReschedule?: (booking: TBooking) => void;
};

export type TClientDetailModalProps = {
  client: TClientInfo | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onMessageClient: (client: TClientInfo) => void;
  onViewBookings: (client: TClientInfo) => void;
  onBlockClient?: (client: TClientInfo) => void;
  onUnblockClient?: (client: TClientInfo) => void;
  bookingsCount: number;
  bookingsCountLoading: boolean;
};

export type TBookingFormProps = {
  services: TSessionType[];
  workingHours: TWorkingHours[];
  daysOff: string[];
  isLoading: boolean;
  clients?: TClientInfo[];
  showRecurring?: boolean;
  bookedDates?: string[];
  clientBatches?: TClientBatch[];
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  onCreateGhostClient?: (name: string) => Promise<TClientInfo>;
  successRedirect: string;
  readOnly?: boolean;
  readOnlyActionLabel?: string;
  title?: string;
  initialDate?: Date;
  initialService?: TSessionType;
  initialTime?: string;
  initialComment?: string;
  initialSelectedClient?: TClientInfo;
};

export type TBookingRowProps = {
  booking: TBooking;
  actionLoading: string | null;
  onRequestCancel: (booking: TBooking) => void;
  onApproveMoveBooking: (booking: TBooking) => void;
  onDeclineMoveBooking: (booking: TBooking) => void;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  tst: TTranslateFunction;
  tc: TTranslateFunction;
  t: TTranslateFunction;
};

export type TPendingBookingCardProps = {
  booking: TBooking;
  onAccept: (booking: TBooking) => void;
  onReject: (booking: TBooking) => void;
  onMessageClient?: (booking: TBooking) => void;
};

export type TRescheduleSheetProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onSuccess: TVoidFunction;
  mode?: 'admin' | 'client';
  withinCutoff?: boolean;
};

export type TUseOnetimeBookingParams = {
  services: TSessionType[];
  bookedDates?: string[];
  clientBatches?: TClientBatch[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
  initialDate?: Date;
  initialService?: TSessionType;
  initialTime?: string;
  initialComment?: string;
};

export type TUseOnetimeBookingReturn = {
  mode: 'single' | 'multi';
  setMode: (mode: 'single' | 'multi') => void;
  selectedService: TSessionType | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  selectedDates: Date[];
  activeDateISO: string | null;
  timeAssignments: Record<string, string>;
  timeSlots: TTimeSlot[];
  disabledDates: string[];
  isLoadingSlots: boolean;
  message: string;
  setMessage: (message: string) => void;
  multiActiveTime: string | null;
  onetimeButtonText: string;
  onetimeButtonDisabled: boolean;
  handleServiceSelect: (service: TSessionType) => void;
  handleEditService: TVoidFunction;
  isServiceSelectable: (service: TSessionType) => boolean;
  handleSingleDateSelect: (date: Date) => void;
  handleSingleTimeSelect: (time: string) => void;
  handleMultiDateToggle: (date: Date) => void;
  handleChipTap: (date: Date) => void;
  handleMultiTimeSelect: (time: string) => void;
  handleOnetimeSubmit: TVoidFunction;
};

export type TRecurringBookingFlowProps = {
  services: TSessionType[];
  clientBatches?: TClientBatch[];
  workingHours: TWorkingHours[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  successRedirect: string;
  readOnly?: boolean;
  readOnlyActionLabel?: string;
};

export type TRecurringDayFormProps = {
  services: TSessionType[];
  recService: TSessionType | null;
  setRecService: Dispatch<SetStateAction<TSessionType | null>>;
  activeDay: number | null;
  handleDayClick: (day: number) => void;
  dayTimeMap: Record<number, string>;
  timeSlotsForActiveDay: string[];
  hasDayTimes: boolean;
  selectedPeriod: string;
  recFormReady: boolean;
  setSelectedPeriod: (value: SetStateAction<string>) => void;
  isPreviewing: boolean;
  readOnly?: boolean;
  readOnlyActionLabel?: string;
  handlePreview: () => Promise<void>;
  previewDates: string[] | null;
  handleRecTimeSelect: (time: string) => void;
  /** Batch services without an active package for the relevant client are not selectable. */
  isServiceBookable?: (service: TSessionType) => boolean;
};

export type TOnetimeBookingFlowProps = {
  services: TSessionType[];
  daysOff: string[];
  bookedDates?: string[];
  clientBatches?: TClientBatch[];
  showRecurring: boolean;
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  nonWorkingDays: number[];
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
  readOnly?: boolean;
  readOnlyActionLabel?: string;
  initialDate?: Date;
  initialService?: TSessionType;
  initialTime?: string;
  initialComment?: string;
};

export type TRecurringScheduleCardProps = {
  schedule: TRecurringSchedule;
  services?: TSessionType[];
  onCancel?: (schedule: TRecurringSchedule) => void;
  onApprove?: (schedule: TRecurringSchedule) => void;
  onDecline?: (schedule: TRecurringSchedule) => void;
  detailPath?: string;
};
