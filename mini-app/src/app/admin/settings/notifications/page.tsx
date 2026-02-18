'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { useAdminNotifications } from '@/hooks/queries';
import { invalidateAdminNotifications } from '@/hooks/mutations';

export default function AdminNotificationsPage() {
  const t = useTranslations('AdminNotifications');
  const te = useTranslations('Errors');
  const { data: prefs, isLoading } = useAdminNotifications();
  const [notifyNewBookings, setNotifyNewBookings] = useState(true);
  const [notifyCancellations, setNotifyCancellations] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized || !prefs) return;

    setNotifyNewBookings(prefs.notifyNewBookings);
    setNotifyCancellations(prefs.notifyCancellations);
    setInitialized(true);
  }, [prefs, isLoading, initialized]);

  const handleToggle = async (key: 'notifyNewBookings' | 'notifyCancellations', value: boolean) => {
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
        <div className="animate-pulse space-y-3 p-4">
          <div className="bg-card h-14 rounded-lg" />
          <div className="bg-card h-14 rounded-lg" />
        </div>
      </div>
    );
  }

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

      <div className="p-4">
        <div className="bg-card divide-border divide-y rounded-lg">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-muted-foreground text-xs">{item.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(item.key, !item.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  item.value ? 'bg-brand' : 'bg-switch-background'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    item.value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
