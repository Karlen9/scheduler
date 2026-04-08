'use client';

import { Bell, CalendarOff, Clock, DollarSign, HelpCircle, User, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { setLocale } from '@/actions/locale';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SettingsGroup, SettingsMenuItem } from '@/components/SettingsMenuItem';
import { ThemeSelector } from '@/components/ThemeSelector';
import { TopBar } from '@/components/TopBar';
import { useAdminProfile } from '@/hooks/queries';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the settings page UI and related interactions.
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
export default function SettingsPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminSettings');
  /***************************************************************************************************
   * Defines the tl value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tl = useTranslations('LanguageSelector');
  /***************************************************************************************************
   * Defines the locale value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();
  /***************************************************************************************************
   * Defines the router value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const { data: specialistProfile } = useAdminProfile();

  /***************************************************************************************************
   * Cross-device language sync.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const syncedRef = useRef(false);
  useEffect(() => {
    if (
      specialistProfile?.language &&
      specialistProfile.language !== locale &&
      !syncedRef.current
    ) {
      syncedRef.current = true;
      setLocale(specialistProfile.language).then(() => router.refresh());
    }
  }, [specialistProfile?.language, locale, router]);

  return (
    <div>
      <TopBar title={t('title')} />

      <div className={'p-4'}>
        <SettingsGroup title={t('management')}>
          <SettingsMenuItem
            icon={Users}
            label={t('clients')}
            href={'/admin/clients'}
            iconColor={'bg-[#a855f7]'}
          />
        </SettingsGroup>

        <SettingsGroup title={t('main')}>
          <SettingsMenuItem
            icon={User}
            label={t('profile')}
            href={'/admin/settings/profile'}
            iconColor={'bg-brand'}
          />
          <SettingsMenuItem
            icon={DollarSign}
            label={t('servicesAndPrices')}
            href={'/admin/settings/services'}
            iconColor={'bg-success'}
          />
          <SettingsMenuItem
            icon={Clock}
            label={t('schedule')}
            href={'/admin/settings/schedule'}
            iconColor={'bg-warning'}
          />
          <SettingsMenuItem
            icon={CalendarOff}
            label={t('daysOff')}
            href={'/admin/settings/days-off'}
            iconColor={'bg-error'}
          />
        </SettingsGroup>

        <SettingsGroup title={t('other')}>
          <SettingsMenuItem
            icon={Bell}
            label={t('notifications')}
            href={'/admin/settings/notifications'}
            iconColor={'bg-[#a855f7]'}
          />
          <SettingsMenuItem
            icon={HelpCircle}
            label={t('help')}
            href={'/admin/settings/help'}
            iconColor={'bg-[#3b82f6]'}
          />
        </SettingsGroup>

        <div className={'mt-2'}>
          <h3 className={'text-muted-foreground mb-3 text-sm'}>{t('theme')}</h3>
          <ThemeSelector />
        </div>

        <div className={'mt-4'}>
          <h3 className={'text-muted-foreground mb-3 text-sm'}>{tl('language')}</h3>
          <LanguageSelector isAdmin />
        </div>
      </div>
    </div>
  );
}
