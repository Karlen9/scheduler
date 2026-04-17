import type { LucideIcon } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import type { ChangeEvent, Dispatch, ReactNode, RefObject, SetStateAction } from 'react';

/***************************************************************************************************
 * Utility Types.
 ***************************************************************************************************/
export type TVoidFunction = () => void;

export type TChangeGroup =
  | 'bookings'
  | 'recurring'
  | 'clients'
  | 'services'
  | 'workingHours'
  | 'daysOff'
  | 'specialist'
  | 'clientProfile'
  | 'adminNotifications';

export type TChangeVersions = Record<TChangeGroup, number>;

/***************************************************************************************************
 * Defines the translate function shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTranslateFunction = ReturnType<typeof useTranslations>;

/***************************************************************************************************
 * Core Data Models.
 ***************************************************************************************************/
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
  wallpaper?: string;
};

/***************************************************************************************************
 * Defines the session type shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TSessionType = {
  id: string;
  type: string;
  name: string;
  durationMinutes: number;
  price: number;
  currency: string;
  imageUrl?: string;
};

/***************************************************************************************************
 * Defines the working interval shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TWorkingInterval = {
  startTime: string;
  endTime: string;
};

/***************************************************************************************************
 * Defines the working hours shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TWorkingHours = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

/***************************************************************************************************
 * Defines the booking shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBooking = {
  id: string;
  clientId?: string;
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
  createdAt?: string;
  recurringScheduleId?: string;
  replacesBookingId?: string;
  clientIsGhost?: boolean;
  clientTelegramUserId?: number;
};

/***************************************************************************************************
 * Defines the time slot shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTimeSlot = {
  time: string;
  endTime?: string;
  available: boolean;
  mine?: boolean;
};

/***************************************************************************************************
 * Defines the client profile shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the client info shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TClientInfo = {
  id: string;
  telegramUserId: number;
  specialistId: string;
  name: string;
  displayName?: string;
  phone?: string;
  photoUrl?: string;
  isGhost?: boolean;
  isBlocked?: boolean;
  createdAt: string;
};

/***************************************************************************************************
 * Defines the day off shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TDayOff = {
  id: string;
  date: string;
  reason?: string;
  createdAt: string;
};

/***************************************************************************************************
 * Defines the schedule context shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TScheduleContext = {
  workingHours: TWorkingHours[];
  daysOff: { date: string }[];
};

/***************************************************************************************************
 * Defines the admin schedule context shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TAdminScheduleContext = {
  workingHours: TWorkingHours[];
  daysOff: TDayOff[];
};

/***************************************************************************************************
 * Defines the recurring schedule shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the recurring preview response shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRecurringPreviewResponse = {
  dates: string[];
  count: number;
};

/***************************************************************************************************
 * Defines the time slot label shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTimeSlotLabel = 'morning' | 'afternoon' | 'evening';

/***************************************************************************************************
 * Defines the duration breakdown shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TDurationBreakdown = {
  duration: number;
  count: number;
};

/***************************************************************************************************
 * Defines the monthly trend point shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TMonthlyTrendPoint = {
  month: string;
  count: number;
};

/***************************************************************************************************
 * Defines the revenue trend point shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRevenueByMonthPoint = {
  month: string;
  revenue: number;
};

/***************************************************************************************************
 * Defines the revenue-by-service shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRevenueByService = {
  name: string;
  revenue: number;
};

/***************************************************************************************************
 * Defines the top client stats shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTopClientStat = {
  name: string;
  count: number;
  photoUrl?: string;
};

/***************************************************************************************************
 * Defines the client stats shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TClientStats = {
  totalSessions: number;
  totalHours: number;
  completionRate: number;
  sessionsThisMonth: number;
  sessionsLastMonth: number;
  currentStreak: number;
  longestStreak: number;
  mostCommonDay: number | null;
  mostCommonTimeSlot: TTimeSlotLabel | null;
  averageDuration: number;
  durationBreakdown: TDurationBreakdown[];
  monthlyTrend: TMonthlyTrendPoint[];
};

/***************************************************************************************************
 * Defines the admin stats shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TAdminStats = {
  totalBookings: number;
  activeClients: number;
  completionRate: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  totalClients: number;
  newClientsThisMonth: number;
  topClients: TTopClientStat[];
  returningRate: number;
  busiestDay: number | null;
  busiestTimeSlot: TTimeSlotLabel | null;
  avgBookingsPerWeek: number;
  cancellationRate: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueCurrency: string;
  revenueByMonth: TRevenueByMonthPoint[];
  revenueByService: TRevenueByService[];
};

/***************************************************************************************************
 * Telegram Types.
 ***************************************************************************************************/
export type TTelegramWebApp = {
  ready: TVoidFunction;
  expand: TVoidFunction;
  close: TVoidFunction;
  disableVerticalSwipes?: TVoidFunction;
  enableVerticalSwipes?: TVoidFunction;
  isVerticalSwipesEnabled?: boolean;
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
      photo_url?: string;
    };
  };
  onEvent: (event: string, callback: TVoidFunction) => void;
  offEvent: (event: string, callback: TVoidFunction) => void;
  openTelegramLink?: (url: string) => void;
};

/***************************************************************************************************
 * Defines the theme preference shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TThemePreference = 'auto' | 'light' | 'dark';

/***************************************************************************************************
 * API / Form Params.
 ***************************************************************************************************/
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

export type TAdminBookingsResponse = {
  bookings: TBooking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/***************************************************************************************************
 * Defines the create recurring params shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TCreateRecurringParams = {
  clientId?: string;
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
};

/***************************************************************************************************
 * Defines the preview recurring params shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TPreviewRecurringParams = {
  sessionTypeId: string;
  dayTimes: Record<string, string>;
  period: string;
};

/***************************************************************************************************
 * Page-Specific Types.
 ***************************************************************************************************/
export type TDaySchedule = {
  enabled: boolean;
  intervals: TWorkingInterval[];
};

/***************************************************************************************************
 * Defines the service form data shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TServiceFormData = {
  type: string;
  name: string;
  price: string;
  duration: string;
  imageUrl: string;
};

/***************************************************************************************************
 * Defines the faqitem shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TFAQItem = {
  question: string;
  answer: string;
};

/***************************************************************************************************
 * Defines the view mode shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TViewMode = 'day' | 'week' | 'month';

/***************************************************************************************************
 * Defines the empty slot shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TEmptySlot = {
  startMin: number;
  endMin: number;
  kind?: 'available' | 'break';
};

/***************************************************************************************************
 * Defines the admin layout props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TAdminLayoutProps = {
  children: ReactNode;
};

/***************************************************************************************************
 * Defines the admin schedule info card props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the avatar section props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the booking card item props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBookingCardItemProps = {
  booking: TBooking;
  onRequestCancel: (booking: TBooking) => void;
  formatBookingDate: (iso: string) => string;
};

/***************************************************************************************************
 * Defines the booking card props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBookingCardProps = {
  booking: TBooking;
  onCancel?: (booking: TBooking) => void;
  onConfirm?: (booking: TBooking) => void;
  onDecline?: (booking: TBooking) => void;
};

/***************************************************************************************************
 * Defines the booking detail modal props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBookingDetailModalProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onReschedule?: (booking: TBooking) => void;
  onCancel?: (booking: TBooking) => void;
  onAccept?: (booking: TBooking) => void;
  onReject?: (booking: TBooking) => void;
  onMessageClient?: (booking: TBooking) => void;
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

/***************************************************************************************************
 * Defines the booking form props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the booking row props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the bottom sheet props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBottomSheetProps = {
  isOpen: boolean;
  onClose: TVoidFunction;
  children: ReactNode;
  title?: string;
  showClose?: boolean;
  className?: string;
};

/***************************************************************************************************
 * Defines the bottom tab bar props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBottomTabBarProps = {
  tabs: TTab[];
  subTabs?: TSubTab[];
};

/***************************************************************************************************
 * Defines the calendar view props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TCalendarViewProps = {
  selectedDate: Date | null;
  selectedDates?: Date[];
  onSelectDate: (date: Date) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  bookedDates?: string[];
};

/***************************************************************************************************
 * Defines the cancel dialog props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TCancelDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
};

/***************************************************************************************************
 * Defines the client avatar props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TClientAvatarProps = {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
};

/***************************************************************************************************
 * Defines the client schedule info card props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the client selector props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TClientSelectorProps = {
  clients?: TClientInfo[];
  selectedClient: TClientInfo | null;
  onCreateGhostClient: ((name: string) => Promise<TClientInfo>) | undefined;
  setSelectedClient: Dispatch<SetStateAction<TClientInfo | null>>;
};

/***************************************************************************************************
 * Defines the confirm dialog props shape shared by the shared utility layer.
 ***************************************************************************************************/
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
  confirmDisabled?: boolean;
  children?: ReactNode;
};

/***************************************************************************************************
 * Defines the current time indicator props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TCurrentTimeIndicatorProps = {
  top: number;
};

/***************************************************************************************************
 * Defines the bar chart point props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBarChartDatum = {
  label: string;
  value: number;
};

/***************************************************************************************************
 * Defines the bar chart props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TBarChartProps = {
  data: TBarChartDatum[];
  valueFormatter?: (value: number) => string;
};

/***************************************************************************************************
 * Defines the day timeline props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TDayTimelineProps = {
  bookings: TBooking[];
  date: Date;
  onBookingClick?: (booking: TBooking) => void;
  workingHours?: TWorkingHours[];
  serviceDurations?: number[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

/***************************************************************************************************
 * Defines the empty state props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

/***************************************************************************************************
 * Defines the month calendar props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TMonthCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingDates?: Date[];
  daysOff?: Date[];
};

/***************************************************************************************************
 * Defines the month grid props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the next booking banner props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TNextBookingBannerProps = {
  booking: TBooking | null;
  onBookingClick?: (booking: TBooking) => void;
};

/***************************************************************************************************
 * Defines the notification preferences props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the onetime booking flow props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the pending booking card props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TPendingBookingCardProps = {
  booking: TBooking;
  onAccept: (booking: TBooking) => void;
  onReject: (booking: TBooking) => void;
  onMessageClient?: (booking: TBooking) => void;
};

/***************************************************************************************************
 * Defines the photo editor props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TPhotoEditorProps = {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: TVoidFunction;
};

/***************************************************************************************************
 * Defines the pinned bottom button props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the primary button props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TPrimaryButtonProps = {
  children: ReactNode;
  onClick?: TVoidFunction;
  disabled?: boolean;
  fullWidth?: boolean;
};

/***************************************************************************************************
 * Defines the recurring booking flow props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRecurringBookingFlowProps = {
  services: TSessionType[];
  workingHours: TWorkingHours[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateRecurring: (params: TCreateRecurringParams) => Promise<void>;
  onPreviewRecurring: (params: TPreviewRecurringParams) => Promise<{ dates: string[] }>;
  successRedirect: string;
};

/***************************************************************************************************
 * Defines the recurring day form props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the recurring schedule card props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRecurringScheduleCardProps = {
  schedule: TRecurringSchedule;
  services?: TSessionType[];
  onCancel?: (schedule: TRecurringSchedule) => void;
  onApprove?: (schedule: TRecurringSchedule) => void;
  onDecline?: (schedule: TRecurringSchedule) => void;
  detailPath?: string;
};

/***************************************************************************************************
 * Defines the reject dialog props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRejectDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
};

/***************************************************************************************************
 * Defines the reschedule sheet props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TRescheduleSheetProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onSuccess: TVoidFunction;
  mode?: 'admin' | 'client';
};

/***************************************************************************************************
 * Defines the schedule view props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TScheduleViewProps = {
  bookings: TBooking[];
  onBookingClick?: (booking: TBooking) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  workingHours?: TWorkingHours[];
  serviceDurations?: number[];
  onEmptySlotClick?: (date: Date, time: string) => void;
};

/***************************************************************************************************
 * Defines the service card props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TServiceCardProps = {
  service: TSessionType;
  onEdit?: TVoidFunction;
};

/***************************************************************************************************
 * Defines the service selector props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TServiceSelectorProps = {
  services: TSessionType[];
  selectedId: string;
  onChange: (service: TSessionType) => void;
};

/***************************************************************************************************
 * Defines the stat bar props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TStatBarProps = {
  label: string;
  value: number;
  maxValue: number;
  valueLabel?: string;
};

/***************************************************************************************************
 * Defines the settings group props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TSettingsGroupProps = {
  title?: string;
  children: ReactNode;
};

/***************************************************************************************************
 * Defines the settings menu item props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TSettingsMenuItemProps = {
  icon: LucideIcon;
  label: string;
  value?: string;
  href: string;
  iconColor?: string;
};

/***************************************************************************************************
 * Defines the stat card props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TStatCardProps = {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: number | string;
  label: string;
  valueSize?: 'base' | 'lg' | 'xl' | '2xl';
  animated?: boolean;
  onClick?: TVoidFunction;
};

/***************************************************************************************************
 * Defines the stats section props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TStatsSectionProps = {
  pendingCount: number;
  bookingsCount: number;
  onPendingClick?: TVoidFunction;
  onBookingsClick: TVoidFunction;
};

/***************************************************************************************************
 * Defines the status badge props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TStatusBadgeProps = {
  status: string;
  className?: string;
};

/***************************************************************************************************
 * Defines the sub tab shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TSubTab = {
  icon: LucideIcon;
  href: string;
  label?: string;
};

/***************************************************************************************************
 * Defines the tab shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  isCenter?: boolean;
  matchPaths?: string[];
};

/***************************************************************************************************
 * Defines the time picker modal props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTimePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  selectedTime?: string;
  title?: string;
  availableTimes?: string[];
};

/***************************************************************************************************
 * Defines the time slot grid props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTimeSlotGridProps = {
  slots: TTimeSlot[];
  selected: string | null;
  onSelect: (time: string) => void;
};

/***************************************************************************************************
 * Defines the timeline booking card props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTimelineBookingCardProps = {
  booking: TBooking;
  top: number;
  height: number;
  onBookingClick?: (booking: TBooking) => void;
  formatTime: (iso: string) => string;
};

/***************************************************************************************************
 * Defines the timeline empty slot props shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the top bar props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TTopBarProps = {
  title: string;
  showBack?: boolean;
  onBack?: TVoidFunction;
};

/***************************************************************************************************
 * Defines the use onetime booking params shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TUseOnetimeBookingParams = {
  services: TSessionType[];
  bookedDates?: string[];
  selectedClient: TClientInfo | null;
  hasClientSelector: boolean;
  onCreateBooking: (params: TCreateBookingParams) => Promise<void>;
  successRedirect: string;
};

/***************************************************************************************************
 * Defines the use onetime booking return shape shared by the shared utility layer.
 ***************************************************************************************************/
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

/***************************************************************************************************
 * Defines the week strip props shape shared by the shared utility layer.
 ***************************************************************************************************/
export type TWeekStripProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: TVoidFunction;
  onNextWeek: TVoidFunction;
  nonWorkingDays?: number[];
  daysOff?: string[];
  dotDates?: Set<string>;
};
