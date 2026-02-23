import type { LucideIcon } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import type { ChangeEvent, Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

// ─── Utility Types ───────────────────────────────────────────────────────────

export type TVoidFunction = () => void;

export type TTranslateFunction = ReturnType<typeof useTranslations>;

// ─── Core Data Models ────────────────────────────────────────────────────────

export type TSpecialist = {
  id: string;
  name: string;
  timezone: string;
  cancelCutoffHours: number;
  botUsername?: string;
  telegramHandle?: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  photoUrl?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  isOwner?: boolean;
  language?: string;
};

export type TSessionType = {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  imageUrl?: string;
};

export type TWorkingHours = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TBooking = {
  id: string;
  sessionType?: TSessionType;
  startsAt: string;
  endsAt: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  clientMessage?: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'cancel_requested'
    | 'reschedule_pending';
  cancelReason?: string;
  cancelledBy?: 'client' | 'specialist';
  durationMinutes?: number;
  createdBy?: 'client' | 'specialist';
  recurringScheduleId?: string;
  replacesBookingId?: string;
};

export type TTimeSlot = {
  time: string;
  endTime?: string;
  available: boolean;
};

export type TClientProfile = {
  id: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  preferredDuration?: number;
  notifyBookingStatus?: boolean;
  notifyReminders?: boolean;
  notifyDaysOff?: boolean;
  notifyCancellations?: boolean;
  language?: string;
};

export type TClientInfo = {
  id: string;
  telegramUserId: number;
  specialistId: string;
  name: string;
  displayName?: string;
  phone?: string;
  photoUrl?: string;
  isGhost?: boolean;
  createdAt: string;
};

export type TDayOff = {
  id: string;
  date: string;
  reason?: string;
  createdAt: string;
};

export type TRecurringSchedule = {
  id: string;
  clientName: string;
  clientDisplayName?: string;
  clientPhotoUrl?: string;
  dayOfWeek: number;
  time: string;
  durationMinutes: number;
  status: 'pending' | 'active' | 'declined' | 'cancelled';
  createdBy: 'client' | 'specialist';
  createdAt: string;
  sessionTypeId?: string;
  sessionType?: TSessionType;
  daysOfWeek?: string;
  startDate?: string;
  endDate?: string;
  dayTimes?: string;
  bookings?: TBooking[];
};

export type TRecurringPreviewResponse = {
  dates: string[];
  count: number;
};

// ─── Telegram Types ──────────────────────────────────────────────────────────

export type TTelegramWebApp = {
  ready: TVoidFunction;
  expand: TVoidFunction;
  close: TVoidFunction;
  colorScheme: 'light' | 'dark';
  MainButton: {
    text: string;
    show: TVoidFunction;
    hide: TVoidFunction;
    onClick: (callback: TVoidFunction) => void;
    offClick: (callback: TVoidFunction) => void;
    enable: TVoidFunction;
    disable: TVoidFunction;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: TVoidFunction;
  };
  BackButton: {
    show: TVoidFunction;
    hide: TVoidFunction;
    onClick: (callback: TVoidFunction) => void;
    offClick: (callback: TVoidFunction) => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
  onEvent: (event: string, callback: TVoidFunction) => void;
  offEvent: (event: string, callback: TVoidFunction) => void;
};

export type TThemePreference = 'auto' | 'light' | 'dark';

// ─── API / Form Params ──────────────────────────────────────────────────────

export type TCreateBookingParams = {
  clientId?: string;
  duration: number;
  date: string;
  time: string;
  message?: string;
};

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

// ─── Page-Specific Types ─────────────────────────────────────────────────────

export type TDaySchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type TServiceFormData = {
  type: string;
  name: string;
  price: string;
  duration: string;
  imageUrl: string;
};

export type TFAQItem = {
  question: string;
  answer: string;
};

export type TViewMode = 'day' | 'week' | 'month';

export type TEmptySlot = {
  startMin: number;
  endMin: number;
};

// ─── Component Prop Types ────────────────────────────────────────────────────

export type TActivityBackButtonProps = {
  href: string;
};

export type TAdminLayoutProps = {
  children: ReactNode;
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

export type TAvatarSectionProps = {
  name: string;
  photoUrl: string;
  photoError: boolean;
  isUploading: boolean;
  onPhotoError: TVoidFunction;
  onClickUpload: TVoidFunction;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
};

export type TBookingCardItemProps = {
  booking: TBooking;
  onRequestCancel: (booking: TBooking) => void;
  formatBookingDate: (iso: string) => string;
};

export type TBookingCardProps = {
  booking: TBooking;
  onCancel?: (booking: TBooking) => void;
  onConfirm?: (booking: TBooking) => void;
  onDecline?: (booking: TBooking) => void;
};

export type TBookingDetailModalProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onReschedule?: (booking: TBooking) => void;
  onCancel?: (booking: TBooking) => void;
  onAccept?: (booking: TBooking) => void;
  onReject?: (booking: TBooking) => void;
};

export type TBookingFormProps = {
  services: TSessionType[];
  workingHours: TWorkingHours[];
  daysOff: string[];
  isLoading: boolean;
  clients?: TClientInfo[];
  showRecurring?: boolean;
  bookedDates?: string[];
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  onCreateGhostClient?: (name: string) => Promise<TClientInfo>;
  successRedirect: string;
  title?: string;
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

export type TBottomSheetProps = {
  isOpen: boolean;
  onClose: TVoidFunction;
  children: ReactNode;
  title?: string;
  showClose?: boolean;
  className?: string;
};

export type TBottomTabBarProps = {
  tabs: TTab[];
  subTabs?: TSubTab[];
};

export type TCalendarViewProps = {
  selectedDate: Date | null;
  selectedDates?: Date[];
  onSelectDate: (date: Date) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  bookedDates?: string[];
};

export type TCancelDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
};

export type TClientAvatarProps = {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
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

export type TClientSelectorProps = {
  clients?: TClientInfo[];
  selectedClient: TClientInfo | null;
  onCreateGhostClient: ((name: string) => Promise<TClientInfo>) | undefined;
  setSelectedClient: Dispatch<SetStateAction<TClientInfo | null>>;
};

export type TConfirmDialogProps = {
  isOpen: boolean;
  onClose: TVoidFunction;
  onConfirm: TVoidFunction;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  showInput?: boolean;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
};

export type TCurrentTimeIndicatorProps = {
  top: number;
};

export type TDayTimelineProps = {
  bookings: TBooking[];
  date: Date;
  onBookingClick?: (booking: TBooking) => void;
  workingHours?: TWorkingHours[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

export type TDurationSelectorProps = {
  durations: number[];
  selected: number;
  onChange: (duration: number) => void;
};

export type TEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export type TMonthCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingDates?: Date[];
  daysOff?: Date[];
};

export type TMonthGridProps = {
  displayDate: Date;
  selectedDate: Date | null;
  selectedDates?: Date[];
  onSelectDate: (date: Date) => void;
  onPrevMonth: TVoidFunction;
  onNextMonth: TVoidFunction;
  nonWorkingDays?: number[];
  daysOff?: string[];
  disablePast?: boolean;
  dotDates?: Set<string>;
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

export type TNotificationPreferencesProps = {
  notifyBookingStatus: boolean;
  notifyReminders: boolean;
  notifyDaysOff: boolean;
  notifyCancellations: boolean;
  onToggle: (
    key: 'notifyBookingStatus' | 'notifyReminders' | 'notifyDaysOff' | 'notifyCancellations',
    value: boolean,
  ) => void;
};

export type TOnetimeBookingFlowProps = {
  services: TSessionType[];
  daysOff: string[];
  bookedDates?: string[];
  showRecurring: boolean;
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  nonWorkingDays: number[];
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
};

export type TPendingBookingCardProps = {
  booking: TBooking;
  onAccept: (booking: TBooking) => void;
  onReject: (booking: TBooking) => void;
};

export type TPhotoEditorProps = {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: TVoidFunction;
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
};

export type TPrimaryButtonProps = {
  children: ReactNode;
  onClick?: TVoidFunction;
  disabled?: boolean;
  fullWidth?: boolean;
};

export type TRecurringBookingFlowProps = {
  services: TSessionType[];
  workingHours: TWorkingHours[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  successRedirect: string;
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
  handlePreview: () => Promise<void>;
  previewDates: string[] | null;
  handleRecTimeSelect: (time: string) => void;
};

export type TRecurringScheduleCardProps = {
  schedule: TRecurringSchedule;
  services?: TSessionType[];
  onCancel?: (schedule: TRecurringSchedule) => void;
  onApprove?: (schedule: TRecurringSchedule) => void;
  onDecline?: (schedule: TRecurringSchedule) => void;
  detailPath?: string;
};

export type TRejectDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
};

export type TRescheduleSheetProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onSuccess: TVoidFunction;
};

export type TScheduleViewProps = {
  bookings: TBooking[];
  onBookingClick?: (booking: TBooking) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  workingHours?: TWorkingHours[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

export type TServiceCardProps = {
  service: TSessionType;
  onEdit?: TVoidFunction;
};

export type TServiceSelectorProps = {
  services: TSessionType[];
  selectedId: string;
  onChange: (service: TSessionType) => void;
};

export type TSettingsGroupProps = {
  title?: string;
  children: ReactNode;
};

export type TSettingsMenuItemProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  href: string;
  iconColor?: string;
};

export type TStatCardProps = {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: number;
  label: string;
  onClick?: TVoidFunction;
};

export type TStatsSectionProps = {
  pendingCount: number;
  clientsCount: number;
  onPendingClick?: TVoidFunction;
  onClientsClick: TVoidFunction;
};

export type TStatusBadgeProps = {
  status: string;
  className?: string;
};

export type TSubTab = {
  icon: LucideIcon;
  href: string;
  label?: string;
};

export type TTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  isCenter?: boolean;
  matchPaths?: string[];
};

export type TTimePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  selectedTime?: string;
  title?: string;
};

export type TTimeSlotGridProps = {
  slots: TTimeSlot[];
  selected: string | null;
  onSelect: (time: string) => void;
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
  onEmptySlotClick?: (date: Date, time: string) => void;
};

export type TTopBarProps = {
  title: string;
  showBack?: boolean;
  onBack?: TVoidFunction;
};

export type TUseOnetimeBookingParams = {
  services: TSessionType[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
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
  isLoadingSlots: boolean;
  message: string;
  setMessage: (message: string) => void;
  multiActiveTime: string | null;
  onetimeButtonText: string;
  onetimeButtonDisabled: boolean;
  handleServiceSelect: (service: TSessionType) => void;
  handleEditService: TVoidFunction;
  handleSingleDateSelect: (date: Date) => void;
  handleSingleTimeSelect: (time: string) => void;
  handleMultiDateToggle: (date: Date) => void;
  handleChipTap: (date: Date) => void;
  handleMultiTimeSelect: (time: string) => void;
  handleOnetimeSubmit: TVoidFunction;
};

export type TWeekStripProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: TVoidFunction;
  onNextWeek: TVoidFunction;
  nonWorkingDays?: number[];
  daysOff?: string[];
  dotDates?: Set<string>;
};
