'use client';

import { useTranslations } from 'next-intl';

import { Switch } from '@/components/Switch';

import type { TNotificationPreferencesProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the notification preferences UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function NotificationPreferences({
  notifyBookingStatus,
  notifyReminders,
  notifyDaysOff,
  notifyCancellations,
  disabled = false,
  onToggle,
}: TNotificationPreferencesProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('ProfilePage');

  /***************************************************************************************************
   * Defines the items value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const items = [
    {
      key: 'notifyBookingStatus' as const,
      label: t('notifyBookingStatus'),
      desc: t('notifyBookingStatusDesc'),
      value: notifyBookingStatus,
    },
    {
      key: 'notifyCancellations' as const,
      label: t('notifyCancellations'),
      desc: t('notifyCancellationsDesc'),
      value: notifyCancellations,
    },
    {
      key: 'notifyReminders' as const,
      label: t('notifyReminders'),
      desc: t('notifyRemindersDesc'),
      value: notifyReminders,
    },
    {
      key: 'notifyDaysOff' as const,
      label: t('notifyDaysOff'),
      desc: t('notifyDaysOffDesc'),
      value: notifyDaysOff,
    },
  ];

  return (
    <div>
      <h3 className={'text-muted-foreground mb-3 text-sm'}>{t('notifications')}</h3>
      <div className={'bg-card divide-border divide-y rounded-lg'}>
        {items.map((item) => (
          <div key={item.key} className={'flex items-center justify-between px-4 py-3'}>
            <div>
              <div className={'text-sm font-medium'}>{item.label}</div>
              <div className={'text-muted-foreground text-xs'}>{item.desc}</div>
            </div>
            <Switch
              checked={item.value}
              onChange={(next) => onToggle(item.key, next)}
              disabled={disabled}
              ariaLabel={item.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
