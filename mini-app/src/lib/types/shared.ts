import type { useTranslations } from 'next-intl';

export type TVoidFunction = () => void;

export type TChangeGroup =
  | 'bookings'
  | 'recurring'
  | 'clients'
  | 'services'
  | 'clientBatches'
  | 'workingHours'
  | 'daysOff'
  | 'specialist'
  | 'clientProfile'
  | 'adminNotifications';

export type TChangeVersions = Record<TChangeGroup, number>;

export type TTranslateFunction = ReturnType<typeof useTranslations>;
