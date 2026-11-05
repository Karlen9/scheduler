'use client';

import {
  CalendarDays,
  Check,
  Crown,
  ExternalLink,
  RussianRuble,
  Users,
  Wallet,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/EmptyState';
import { StatBar } from '@/components/StatBar';
import { StatCard } from '@/components/StatCard';
import { useAdminStats, useSubscription } from '@/hooks/queries';
import { openTelegramUserChat } from '@/lib/telegram';

import type { ReactNode } from 'react';

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(value);
}

function formatPercent(value: number, locale: string): string {
  return `${formatNumber(Math.round(value), locale)}%`;
}

function formatCompactAmount(value: number, locale: string): string {
  if (Math.abs(value) < 1000) {
    return formatNumber(value, locale);
  }

  const scaled = value / 1000;
  const maximumFractionDigits = Number.isInteger(scaled) ? 0 : 1;
  const suffix = locale === 'en' ? 'k' : ' тыс.';
  return `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    maximumFractionDigits,
  }).format(scaled)}${suffix}`;
}

function formatCompactCurrency(value: number, currency: string, locale: string): string {
  const suffix = currency === 'RUB' ? '' : currency;
  return suffix
    ? `${formatCompactAmount(value, locale)} ${suffix}`
    : formatCompactAmount(value, locale);
}

function formatDelta(current: number, previous: number, locale: string): string {
  const delta = current - previous;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatNumber(delta, locale)}`;
}

/***************************************************************************************************
 * Renders simple admin analytics.
 ***************************************************************************************************/
export default function AdminAnalyticsPage(): ReactNode {
  const locale = useLocale();
  const t = useTranslations('AdminAnalytics');
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const isPro = subscription?.isPro ?? true;
  const { data: stats, isLoading, error } = useAdminStats();

  if (subLoading || isLoading) {
    return (
      <div className={'space-y-6 p-4'}>
        <div className={'animate-pulse space-y-3'}>
          <div className={'bg-card h-7 w-32 rounded'} />
          <div className={'grid grid-cols-2 gap-3'}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={'bg-card h-28 rounded-xl'} />
            ))}
          </div>
        </div>
        <div className={'bg-card h-40 animate-pulse rounded-xl'} />
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className={'relative min-h-[520px] p-4'}>
        <div aria-hidden={true} className={'pointer-events-none space-y-6 blur-[6px] select-none'}>
          <div>
            <h1 className={'text-foreground text-xl font-semibold'}>{t('title')}</h1>
            <p className={'text-muted-foreground mt-1 text-sm'}>
              {'+'}
              {18} {t('vsLastMonth')}
            </p>
          </div>
          <div className={'grid grid-cols-2 gap-3'}>
            <StatCard
              icon={CalendarDays}
              iconColor={'text-brand'}
              iconBg={'bg-brand/20'}
              value={'128'}
              label={t('bookingsThisMonth')}
            />
            <StatCard
              icon={RussianRuble}
              iconColor={'text-success'}
              iconBg={'bg-success/20'}
              value={locale === 'en' ? '84k' : '84 тыс.'}
              label={t('revenueThisMonth')}
            />
            <StatCard
              icon={Users}
              iconColor={'text-warning'}
              iconBg={'bg-warning/20'}
              value={'46'}
              label={t('activeClients')}
            />
            <StatCard
              icon={Check}
              iconColor={'text-brand'}
              iconBg={'bg-brand/20'}
              value={'92%'}
              label={t('completionRate')}
            />
          </div>
          <div className={'bg-card space-y-5 rounded-xl p-4'}>
            <StatBar label={t('completionRate')} value={92} maxValue={100} valueLabel={'92%'} />
            <StatBar label={t('cancellationRate')} value={8} maxValue={100} valueLabel={'8%'} />
          </div>
        </div>
        <div className={'absolute inset-0 flex items-center justify-center p-6'}>
          <div className={'bg-card w-full max-w-xs rounded-2xl p-6 text-center shadow-lg'}>
            <div
              className={
                'bg-warning/15 text-warning mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full'
              }
            >
              <Crown className={'h-6 w-6'} />
            </div>
            <h2 className={'text-foreground text-base font-semibold'}>{t('proLockedTitle')}</h2>
            <p className={'text-muted-foreground mt-1 text-sm'}>{t('proLockedDescription')}</p>
            <button
              type={'button'}
              onClick={() => openTelegramUserChat(subscription?.masterBotUsername)}
              className={
                'bg-brand mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80'
              }
            >
              <ExternalLink className={'h-4 w-4'} />
              {t('proManageButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={'p-4'}>
        <div className={'bg-action-danger-bg text-action-danger-text rounded-xl p-4 text-center'}>
          {error.message}
        </div>
      </div>
    );
  }

  if (!stats || stats.totalBookings === 0) {
    return (
      <div className={'flex min-h-[520px] items-center justify-center p-4'}>
        <EmptyState
          icon={<CalendarDays className={'h-16 w-16'} />}
          title={t('title')}
          description={t('emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className={'space-y-6 p-4'}>
      <div>
        <h1 className={'text-foreground text-xl font-semibold'}>{t('title')}</h1>
        <p className={'text-muted-foreground mt-1 text-sm'}>
          {formatDelta(stats.bookingsThisMonth, stats.bookingsLastMonth, locale)} {t('vsLastMonth')}
        </p>
      </div>

      <div className={'grid grid-cols-2 gap-3'}>
        <StatCard
          icon={CalendarDays}
          iconColor={'text-brand'}
          iconBg={'bg-brand/20'}
          value={formatNumber(stats.bookingsThisMonth, locale)}
          label={t('bookingsThisMonth')}
        />
        <StatCard
          icon={stats.revenueCurrency === 'RUB' ? RussianRuble : Wallet}
          iconColor={'text-success'}
          iconBg={'bg-success/20'}
          value={formatCompactCurrency(stats.revenueThisMonth, stats.revenueCurrency, locale)}
          label={t('revenueThisMonth')}
        />
        <StatCard
          icon={Users}
          iconColor={'text-warning'}
          iconBg={'bg-warning/20'}
          value={formatNumber(stats.activeClients, locale)}
          label={t('activeClients')}
        />
        <StatCard
          icon={Check}
          iconColor={'text-brand'}
          iconBg={'bg-brand/20'}
          value={formatPercent(stats.completionRate, locale)}
          label={t('completionRate')}
        />
      </div>

      <section className={'space-y-4'}>
        <div className={'flex items-center justify-between gap-3'}>
          <h2 className={'text-foreground text-base font-semibold'}>{t('schedule')}</h2>
          <span className={'text-muted-foreground text-xs'}>
            {t('bookingsLastMonth')}
            {': '}
            {formatNumber(stats.bookingsLastMonth, locale)}
          </span>
        </div>
        <div className={'bg-card space-y-5 rounded-xl p-4'}>
          <StatBar
            label={t('completionRate')}
            value={stats.completionRate}
            maxValue={100}
            valueLabel={formatPercent(stats.completionRate, locale)}
          />
          <StatBar
            label={t('cancellationRate')}
            value={stats.cancellationRate}
            maxValue={100}
            valueLabel={formatPercent(stats.cancellationRate, locale)}
          />
        </div>
      </section>

      <section className={'space-y-3'}>
        <h2 className={'text-foreground text-base font-semibold'}>{t('revenue')}</h2>
        <div className={'bg-card flex items-center justify-between gap-3 rounded-xl p-4'}>
          <span className={'text-muted-foreground text-sm'}>{t('revenueLastMonth')}</span>
          <span className={'text-foreground text-sm font-semibold'}>
            {formatCompactCurrency(stats.revenueLastMonth, stats.revenueCurrency, locale)}
          </span>
        </div>
      </section>
    </div>
  );
}
