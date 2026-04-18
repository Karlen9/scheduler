'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Switch } from '@/components/Switch';
import { TopBar } from '@/components/TopBar';
import { invalidateAdminNotifications } from '@/hooks/mutations';
import { useAdminNotifications } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the admin notifications page UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export default function AdminNotificationsPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminNotifications');
  /***************************************************************************************************
   * Defines the te value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  const { data: prefs, isLoading } = useAdminNotifications();
  const [notifyNewBookings, setNotifyNewBookings] = useState(true);
  const [notifyCancellations, setNotifyCancellations] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized || !prefs) {
      return;
    }

    setNotifyNewBookings(prefs.notifyNewBookings);
    setNotifyCancellations(prefs.notifyCancellations);
    setInitialized(true);
  }, [prefs, isLoading, initialized]);

  /***************************************************************************************************
   * Defines the handle toggle value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleToggle = async (
    key: 'notifyNewBookings' | 'notifyCancellations',
    value: boolean,
  ): Promise<void> => {
    /***************************************************************************************************
     * Defines the setters value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const setters = {
      notifyNewBookings: setNotifyNewBookings,
      notifyCancellations: setNotifyCancellations,
    };
    setters[key](value);
    try {
      await api.admin.updateNotificationPrefs({ [key]: value });
      invalidateAdminNotifications();
    } catch {
      setters[key](!value);
      toast.error(te('saveSettingsFailed'));
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'animate-pulse space-y-3 p-4'}>
          <div className={'bg-card h-14 rounded-lg'} />
          <div className={'bg-card h-14 rounded-lg'} />
        </div>
      </div>
    );
  }

  /***************************************************************************************************
   * Defines the items value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const items = [
    {
      key: 'notifyNewBookings' as const,
      label: t('newBookings'),
      desc: t('newBookingsDesc'),
      value: notifyNewBookings,
    },
    {
      key: 'notifyCancellations' as const,
      label: t('clientCancellations'),
      desc: t('clientCancellationsDesc'),
      value: notifyCancellations,
    },
  ];

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'p-4'}>
        <div className={'bg-card divide-border divide-y rounded-lg'}>
          {items.map((item) => (
            <div key={item.key} className={'flex items-center justify-between px-4 py-3'}>
              <div>
                <div className={'text-sm font-medium'}>{item.label}</div>
                <div className={'text-muted-foreground text-xs'}>{item.desc}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(next) => {
                  void handleToggle(item.key, next);
                }}
                ariaLabel={item.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
