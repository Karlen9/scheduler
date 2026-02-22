'use client';

import { useTranslations } from 'next-intl';

interface NotificationPreferencesProps {
  notifyBookingStatus: boolean;
  notifyReminders: boolean;
  notifyDaysOff: boolean;
  notifyCancellations: boolean;
  onToggle: (
    key: 'notifyBookingStatus' | 'notifyReminders' | 'notifyDaysOff' | 'notifyCancellations',
    value: boolean,
  ) => void;
}

export function NotificationPreferences({
  notifyBookingStatus,
  notifyReminders,
  notifyDaysOff,
  notifyCancellations,
  onToggle,
}: NotificationPreferencesProps) {
  const t = useTranslations('ProfilePage');

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
      <h3 className="text-muted-foreground mb-3 text-sm">{t('notifications')}</h3>
      <div className="bg-card divide-border divide-y rounded-lg">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-muted-foreground text-xs">{item.desc}</div>
            </div>
            <button
              type="button"
              onClick={() => onToggle(item.key, !item.value)}
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
  );
}
