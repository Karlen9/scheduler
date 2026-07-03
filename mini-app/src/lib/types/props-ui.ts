import type { TSessionType } from './domain';
import type { TVoidFunction } from './shared';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type TServiceFormData = {
  type: string;
  name: string;
  price: string;
  duration: string;
  sessionsCount: string;
};

export type TFAQItem = {
  question: string;
  answer: string;
};

export type TAdminLayoutProps = {
  children: ReactNode;
};

export type TAvatarSectionProps = {
  name: string;
  photoUrl: string;
  photoError: boolean;
  onPhotoError: TVoidFunction;
};

export type TBottomSheetProps = {
  isOpen: boolean;
  onClose: TVoidFunction;
  children: ReactNode;
  title?: string;
  showClose?: boolean;
  className?: string;
};

type TSubTab = {
  icon: LucideIcon;
  href: string;
  label?: string;
};

type TTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  isCenter?: boolean;
  matchPaths?: string[];
  locked?: boolean;
};

export type TBottomTabBarProps = {
  tabs: TTab[];
  subTabs?: TSubTab[];
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
  isSelf?: boolean;
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
  confirmDisabled?: boolean;
  children?: ReactNode;
  holdToConfirm?: boolean;
  holdDurationMs?: number;
};

export type TEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export type TNotificationPreferencesProps = {
  notifyBookingStatus: boolean;
  notifyReminders: boolean;
  notifyDaysOff: boolean;
  notifyCancellations: boolean;
  disabled?: boolean;
  onToggle: (
    key: 'notifyBookingStatus' | 'notifyReminders' | 'notifyDaysOff' | 'notifyCancellations',
    value: boolean,
  ) => void;
};

export type TPhotoEditorProps = {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: TVoidFunction;
};

export type TPrimaryButtonProps = {
  children: ReactNode;
  onClick?: TVoidFunction;
  disabled?: boolean;
  fullWidth?: boolean;
};

export type TRejectDialogProps = {
  isOpen: boolean;
  targetName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: TVoidFunction;
  onClose: TVoidFunction;
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

export type TStatBarProps = {
  label: string;
  value: number;
  maxValue: number;
  valueLabel?: string;
};

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

export type TStatsSectionProps = {
  pendingCount: number;
  bookingsCount: number;
  onPendingClick?: TVoidFunction;
  onBookingsClick: TVoidFunction;
};

export type TStatusBadgeProps = {
  status: string;
  className?: string;
};

export type TTimePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  selectedTime?: string;
  title?: string;
  availableTimes?: string[];
};

export type TTopBarProps = {
  title: string;
  showBack?: boolean;
  onBack?: TVoidFunction;
};
