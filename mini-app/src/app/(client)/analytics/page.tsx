'use client';

import { BarChart3, CalendarDays, CheckCircle2, Clock3, TimerReset } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { BarChart } from '@/components/BarChart';
import { EmptyState } from '@/components/EmptyState';
import { StatBar } from '@/components/StatBar';
import { StatCard } from '@/components/StatCard';
import { TopBar } from '@/components/TopBar';
import { useClientStats } from '@/hooks/queries';

import type { ReactNode } from 'react';

const monthKeys = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];
const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function formatMonthLabel(
  month: string,
  locale: string,
  tm: ReturnType<typeof useTranslations>,
): string {
  const [year, monthNumber] = month.split('-');
  const parsedMonth = Number(monthNumber);
  if (!year || Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return month;
  }

  if (locale === 'ru') {
    return tm(monthKeys[parsedMonth - 1]);
  }

  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/***************************************************************************************************
 * Renders the client analytics page UI and related interactions.
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
export default function AnalyticsPage(): ReactNode {
  const t = useTranslations('Analytics');
  const td = useTranslations('Dates.daysShort');
  const tm = useTranslations('Dates.monthsShortCap');
  const locale = useLocale();
  const { data, isLoading, error } = useClientStats();

  if (error) {
    return (
      <div>
        <TopBar title={t('title')} />
        <div className={'p-4'}>
          <div className={'bg-card text-muted-foreground rounded-xl p-4 text-sm'}>
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <TopBar title={t('title')} />
        <div className={'space-y-4 p-4'}>
          <div className={'grid grid-cols-2 gap-3'}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={'bg-card animate-pulse rounded-xl p-4'}>
                <div className={'bg-border h-3 w-20 rounded'} />
                <div className={'mt-4 flex items-center justify-between'}>
                  <div className={'bg-border h-8 w-8 rounded-full'} />
                  <div className={'bg-border h-8 w-16 rounded'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.totalSessions === 0) {
    return (
      <div>
        <TopBar title={t('title')} />
        <EmptyState
          icon={<BarChart3 className={'h-10 w-10'} />}
          title={t('noData')}
          description={t('emptyDescription')}
        />
      </div>
    );
  }

  const durationMax = Math.max(...data.durationBreakdown.map((item) => item.count), 0);
  const monthlyData = data.monthlyTrend.map((item) => ({
    label: formatMonthLabel(item.month, locale, tm),
    value: item.count,
  }));
  const mostCommonDay =
    data.mostCommonDay === null ? t('noData') : td(dayKeys[data.mostCommonDay] ?? 'mon');
  const mostCommonTime = data.mostCommonTimeSlot == null ? t('noData') : t(data.mostCommonTimeSlot);

  return (
    <div>
      <TopBar title={t('title')} />
      <div className={'space-y-4 p-4'}>
        <div className={'grid grid-cols-2 gap-3'}>
          <StatCard
            icon={CalendarDays}
            iconColor={'text-brand'}
            iconBg={'bg-brand/20'}
            value={data.totalSessions}
            label={t('totalSessions')}
          />
          <StatCard
            icon={Clock3}
            iconColor={'text-brand'}
            iconBg={'bg-brand/20'}
            value={data.totalHours.toFixed(1)}
            label={t('totalHours')}
          />
          <StatCard
            icon={CheckCircle2}
            iconColor={'text-success'}
            iconBg={'bg-success/20'}
            value={`${Math.round(data.completionRate)}%`}
            label={t('completionRate')}
          />
          <StatCard
            icon={BarChart3}
            iconColor={'text-warning'}
            iconBg={'bg-warning/20'}
            value={data.sessionsThisMonth}
            label={t('sessionsThisMonth')}
          />
        </div>

        <section className={'space-y-2'}>
          <h2 className={'text-foreground text-base font-semibold'}>{t('patterns')}</h2>
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'space-y-3'}>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('currentStreak')}</span>
                <span className={'text-foreground text-sm font-medium'}>
                  {data.currentStreak} {t('weeks')}
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('longestStreak')}</span>
                <span className={'text-foreground text-sm font-medium'}>
                  {data.longestStreak} {t('weeks')}
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('mostCommonDay')}</span>
                <span className={'text-foreground text-sm font-medium'}>{mostCommonDay}</span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('mostCommonTime')}</span>
                <span className={'text-foreground text-sm font-medium'}>{mostCommonTime}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={'space-y-2'}>
          <h2 className={'text-foreground text-base font-semibold'}>{t('byDuration')}</h2>
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'mb-4 flex items-center justify-between'}>
              <div className={'flex items-center gap-2'}>
                <TimerReset className={'text-brand h-4 w-4'} />
                <span className={'text-muted-foreground text-xs'}>{t('averageDuration')}</span>
              </div>
              <span className={'text-foreground text-sm font-medium'}>
                {Math.round(data.averageDuration)} {t('minutes')}
              </span>
            </div>

            {data.durationBreakdown.length === 0 ? (
              <p className={'text-muted-foreground text-sm'}>{t('noData')}</p>
            ) : (
              <div className={'space-y-4'}>
                {data.durationBreakdown.map((item) => (
                  <StatBar
                    key={item.duration}
                    label={`${item.duration} ${t('minutes')}`}
                    value={item.count}
                    maxValue={durationMax}
                    valueLabel={String(item.count)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={'space-y-2'}>
          <h2 className={'text-foreground text-base font-semibold'}>{t('byMonth')}</h2>
          <div className={'bg-card rounded-xl p-4'}>
            {monthlyData.some((item) => item.value > 0) ? (
              <BarChart data={monthlyData} />
            ) : (
              <div className={'flex min-h-40 items-center justify-center'}>
                <div className={'text-muted-foreground text-center text-sm'}>{t('noData')}</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
