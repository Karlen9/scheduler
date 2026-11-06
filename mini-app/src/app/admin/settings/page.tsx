'use client';

import {
  Bell,
  CalendarOff,
  Clock,
  DollarSign,
  FileText,
  Gift,
  HelpCircle,
  Shield,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { setLocale } from '@/actions/locale';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LanguageSelector } from '@/components/LanguageSelector';
import { SettingsGroup, SettingsMenuItem } from '@/components/SettingsMenuItem';
import { ThemeSelector } from '@/components/ThemeSelector';
import { TopBar } from '@/components/TopBar';
import { useAdminProfile } from '@/hooks/queries';
import { api } from '@/lib/api';
import { getTelegramWebApp } from '@/lib/telegram';

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
  const td = useTranslations('DeleteBot');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const requiredPhrase = td('requiredPhrase');
  const alternatePhrase = td('requiredPhraseAlt');
  const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const phraseMatches =
    normalise(deletePhrase) === normalise(requiredPhrase) ||
    normalise(deletePhrase) === normalise(alternatePhrase);

  const handleDeleteBot = async (): Promise<void> => {
    if (!phraseMatches || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await api.admin.deleteBot(deletePhrase.trim());
      toast.success(td('successToast'));
      getTelegramWebApp()?.close?.();
    } catch (err) {
      console.error(err);
      toast.error(td('errorToast'));
    } finally {
      setDeleting(false);
    }
  };

  /***************************************************************************************************
   * Cross-device language sync.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const syncingLanguageRef = useRef<string | null>(null);
  useEffect(() => {
    const targetLanguage = specialistProfile?.language;
    if (!targetLanguage || targetLanguage === locale) {
      syncingLanguageRef.current = null;
      return;
    }

    if (syncingLanguageRef.current === targetLanguage) {
      return;
    }

    let active = true;
    syncingLanguageRef.current = targetLanguage;

    void (async () => {
      try {
        await setLocale(targetLanguage);
        if (!active) {
          return;
        }
        router.refresh();
      } catch (err) {
        if (!active) {
          return;
        }
        syncingLanguageRef.current = null;
        console.error('Failed to sync locale:', err);
      }
    })();

    return () => {
      active = false;
    };
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
          <SettingsMenuItem
            icon={Gift}
            label={t('referrals')}
            href={'/admin/settings/referrals'}
            iconColor={'bg-[#ec4899]'}
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

        <SettingsGroup title={t('legal')}>
          <SettingsMenuItem
            icon={FileText}
            label={t('termsOfUse')}
            href={'/terms'}
            iconColor={'bg-[#64748b]'}
          />
          <SettingsMenuItem
            icon={Shield}
            label={t('privacyPolicy')}
            href={'/privacy'}
            iconColor={'bg-[#64748b]'}
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

        <div className={'mt-6'}>
          <h3 className={'text-destructive mb-2 px-1 text-sm font-medium'}>{td('zoneTitle')}</h3>
          <div className={'bg-card divide-border divide-y overflow-hidden rounded-xl'}>
            <button
              type={'button'}
              onClick={() => {
                setDeletePhrase('');
                setDeleteOpen(true);
              }}
              className={
                'active:bg-surface-hover flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors'
              }
            >
              <div
                className={
                  'bg-destructive flex h-8 w-8 shrink-0 items-center justify-center rounded-lg'
                }
              >
                <Trash2 className={'h-[18px] w-[18px] text-white'} />
              </div>
              <div className={'flex-1'}>
                <div className={'text-destructive text-[15px] font-medium'}>
                  {td('deleteButton')}
                </div>
                <div className={'text-muted-foreground mt-0.5 text-xs'}>{td('deleteSubtitle')}</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteBot}
        title={td('modalTitle')}
        description={td('modalBody', { phrase: requiredPhrase })}
        confirmText={deleting ? td('deleting') : td('holdToConfirm')}
        destructive
        holdToConfirm
        holdDurationMs={2000}
        showInput
        inputPlaceholder={requiredPhrase}
        inputValue={deletePhrase}
        onInputChange={setDeletePhrase}
        confirmDisabled={!phraseMatches || deleting}
      />
    </div>
  );
}
