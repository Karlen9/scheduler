'use client';

import { Check, Crown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { Switch } from '@/components/Switch';
import { TopBar } from '@/components/TopBar';
import { useSubscription } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { ReactNode } from 'react';

export default function SubscriptionPage(): ReactNode {
  const t = useTranslations('Subscription');
  const locale = useLocale();
  const { data, isLoading, mutate } = useSubscription();

  const [actioning, setActioning] = useState(false);

  const formatDate = useCallback(
    (iso: string | undefined): string => {
      if (!iso) {
        return '';
      }
      const d = new Date(iso);
      return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
    [locale],
  );

  const daysLeft = useCallback((iso: string | undefined): number => {
    if (!iso) {
      return 0;
    }
    const diff = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  const handleCancelAutoRenew = useCallback(async (): Promise<void> => {
    setActioning(true);
    try {
      const updated = await api.admin.cancelSubscription();
      await mutate(updated, { revalidate: false });
      toast.success(t('cancelSuccess'));
    } catch {
      toast.error(t('actionError'));
    } finally {
      setActioning(false);
    }
  }, [mutate, t]);

  const handleResumeAutoRenew = useCallback(async (): Promise<void> => {
    setActioning(true);
    try {
      const updated = await api.admin.resumeSubscription();
      await mutate(updated, { revalidate: false });
      toast.success(t('resumeSuccess'));
    } catch {
      toast.error(t('actionError'));
    } finally {
      setActioning(false);
    }
  }, [mutate, t]);

  const renderStatus = (): ReactNode => {
    if (!data) {
      return null;
    }
    const { status, isPro, trialEndsAt, currentPeriodEndAt, cancelAtPeriodEnd } = data;

    if (status === 'trialing' && trialEndsAt) {
      return (
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'flex items-center gap-3'}>
            <div
              className={
                'bg-warning/15 text-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
              }
            >
              <Crown className={'h-5 w-5'} />
            </div>
            <div>
              <div className={'text-foreground font-medium'}>{t('statusTrial')}</div>
              <div className={'text-muted-foreground text-sm'}>
                {t('statusTrialDaysLeft', { days: daysLeft(trialEndsAt) })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isPro && currentPeriodEndAt) {
      if (cancelAtPeriodEnd) {
        return (
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'flex items-center gap-3'}>
              <div
                className={
                  'bg-warning/15 text-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
                }
              >
                <Crown className={'h-5 w-5'} />
              </div>
              <div>
                <div className={'text-foreground font-medium'}>{t('statusCancelled')}</div>
                <div className={'text-muted-foreground text-sm'}>
                  {t('statusCancelledUntil', { date: formatDate(currentPeriodEndAt) })}
                </div>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'flex items-center gap-3'}>
            <div
              className={
                'bg-success/15 text-success flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
              }
            >
              <Crown className={'h-5 w-5'} />
            </div>
            <div>
              <div className={'text-foreground font-medium'}>{t('statusActive')}</div>
              <div className={'text-muted-foreground text-sm'}>
                {t('statusActiveUntil', { date: formatDate(currentPeriodEndAt) })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'text-foreground font-medium'}>{t('statusExpired')}</div>
        </div>
      );
    }

    return (
      <div className={'bg-card rounded-xl p-4'}>
        <div className={'text-foreground font-medium'}>{t('statusFree')}</div>
      </div>
    );
  };

  const benefits: { titleKey: string; hintKey: string }[] = [
    { titleKey: 'benefitSelfBooking', hintKey: 'benefitSelfBookingHint' },
    { titleKey: 'benefitRecurring', hintKey: 'benefitRecurringHint' },
    { titleKey: 'benefitBulkDaysOff', hintKey: 'benefitBulkDaysOffHint' },
    { titleKey: 'benefitAnalytics', hintKey: 'benefitAnalyticsHint' },
  ];

  return (
    <div>
      <TopBar title={t('title')} showBack />
      <div className={'space-y-4 p-4'}>
        {isLoading ? <div className={'bg-card h-20 animate-pulse rounded-xl'} /> : renderStatus()}

        <div className={'bg-card rounded-xl p-4'}>
          <h3 className={'text-foreground mb-3 text-[15px] font-medium'}>{t('benefitsHeading')}</h3>
          <div className={'space-y-3'}>
            {benefits.map(({ titleKey, hintKey }) => (
              <div key={titleKey} className={'flex items-start gap-3'}>
                <div
                  className={
                    'bg-success/15 text-success mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full'
                  }
                >
                  <Check className={'h-3 w-3'} />
                </div>
                <div>
                  <div className={'text-foreground text-sm font-medium'}>
                    {t(titleKey as Parameters<typeof t>[0])}
                  </div>
                  <div className={'text-muted-foreground text-xs'}>
                    {t(hintKey as Parameters<typeof t>[0])}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {data?.status === 'active' && (
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'flex items-center justify-between gap-3'}>
              <div>
                <div className={'text-foreground text-[15px] font-medium'}>
                  {t('autoRenewToggleLabel')}
                </div>
                <div className={'text-muted-foreground text-sm'}>
                  {data.cancelAtPeriodEnd ? t('autoRenewOff') : t('autoRenewOn')}
                </div>
              </div>
              <Switch
                checked={!data.cancelAtPeriodEnd}
                disabled={actioning}
                ariaLabel={t('autoRenewToggleLabel')}
                onChange={(next) => {
                  if (next) {
                    void handleResumeAutoRenew();
                  } else {
                    void handleCancelAutoRenew();
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
