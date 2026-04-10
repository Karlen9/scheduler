'use client';

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { BarChart } from '@/components/BarChart';
import { ClientAvatar } from '@/components/ClientAvatar';
import { EmptyState } from '@/components/EmptyState';
import { StatBar } from '@/components/StatBar';
import { StatCard } from '@/components/StatCard';
import { TopBar } from '@/components/TopBar';
import { useAdminStats } from '@/hooks/queries';

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
 * Renders the admin analytics page UI and related interactions.
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
export default function AdminAnalyticsPage(): ReactNode {
  const t = useTranslations('AdminAnalytics');
  const td = useTranslations('Dates.daysShort');
  const tm = useTranslations('Dates.monthsShortCap');
  const locale = useLocale();
  const { data, isLoading, error } = useAdminStats();

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

  if (data.totalBookings === 0) {
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

  const revenueFormatter =
    data.revenueCurrency === ''
      ? (value: number): string => `${value}`
      : (value: number): string =>
          new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: data.revenueCurrency,
            maximumFractionDigits: 0,
          }).format(value);

  const monthlyRevenue = data.revenueByMonth.map((item) => ({
    label: formatMonthLabel(item.month, locale, tm),
    value: item.revenue,
  }));
  const revenueMax = Math.max(...data.revenueByService.map((item) => item.revenue), 0);
  const showRevenue =
    data.revenueCurrency !== '' ||
    data.revenueByService.length > 0 ||
    data.revenueByMonth.some((item) => item.revenue > 0);
  const busiestDay = data.busiestDay === null ? t('noData') : td(dayKeys[data.busiestDay] ?? 'mon');
  const busiestTime = data.busiestTimeSlot == null ? t('noData') : t(data.busiestTimeSlot);
  const monthDelta = data.bookingsThisMonth - data.bookingsLastMonth;

  return (
    <div>
      <TopBar title={t('title')} />
      <div className={'space-y-4 p-4'}>
        <section className={'space-y-3'}>
          <div className={'grid grid-cols-2 gap-3'}>
            <StatCard
              icon={CalendarDays}
              iconColor={'text-brand'}
              iconBg={'bg-brand/20'}
              value={data.totalBookings}
              label={t('totalBookings')}
            />
            <StatCard
              icon={Users}
              iconColor={'text-brand'}
              iconBg={'bg-brand/20'}
              value={data.activeClients}
              label={t('activeClients')}
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
              value={data.bookingsThisMonth}
              label={t('bookingsThisMonth')}
            />
          </div>
          <p className={'text-muted-foreground px-1 text-xs'}>
            {monthDelta >= 0 ? '+' : ''}
            {monthDelta} {t('vsLastMonth')}
          </p>
        </section>

        <section className={'space-y-2'}>
          <h2 className={'text-foreground text-base font-semibold'}>{t('clientInsights')}</h2>
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'space-y-3'}>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('totalClients')}</span>
                <span className={'text-foreground text-sm font-medium'}>{data.totalClients}</span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('newClients')}</span>
                <span className={'text-foreground text-sm font-medium'}>
                  {data.newClientsThisMonth}
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('returningRate')}</span>
                <span className={'text-foreground text-sm font-medium'}>
                  {`${Math.round(data.returningRate)}%`}
                </span>
              </div>
            </div>

            <div className={'border-border mt-4 border-t pt-4'}>
              <p className={'text-foreground mb-3 text-sm font-medium'}>{t('topClients')}</p>
              {data.topClients.length === 0 ? (
                <p className={'text-muted-foreground text-sm'}>{t('noData')}</p>
              ) : (
                <div className={'space-y-3'}>
                  {data.topClients.map((client) => (
                    <div
                      key={`${client.name}-${client.count}`}
                      className={'flex items-center gap-3'}
                    >
                      <ClientAvatar name={client.name} photoUrl={client.photoUrl} size={'sm'} />
                      <div className={'min-w-0 flex-1'}>
                        <p className={'text-foreground truncate text-sm font-medium'}>
                          {client.name}
                        </p>
                      </div>
                      <span className={'text-muted-foreground text-xs'}>
                        {client.count} {t('sessions')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={'space-y-2'}>
          <h2 className={'text-foreground text-base font-semibold'}>{t('schedule')}</h2>
          <div className={'bg-card rounded-xl p-4'}>
            <div className={'space-y-3'}>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('busiestDay')}</span>
                <span className={'text-foreground text-sm font-medium'}>{busiestDay}</span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('busiestTime')}</span>
                <span className={'text-foreground text-sm font-medium'}>{busiestTime}</span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('avgPerWeek')}</span>
                <span className={'text-foreground text-sm font-medium'}>
                  {data.avgBookingsPerWeek.toFixed(1)}
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <span className={'text-muted-foreground text-sm'}>{t('cancellationRate')}</span>
                <span className={'text-foreground text-sm font-medium'}>
                  {`${Math.round(data.cancellationRate)}%`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {showRevenue && (
          <section className={'space-y-2'}>
            <h2 className={'text-foreground text-base font-semibold'}>{t('revenue')}</h2>
            <div className={'bg-card rounded-xl p-4'}>
              <div className={'grid grid-cols-2 gap-3'}>
                <div className={'bg-brand/10 rounded-xl p-3'}>
                  <div className={'mb-2 flex items-center gap-2'}>
                    <DollarSign className={'text-brand h-4 w-4'} />
                    <span className={'text-muted-foreground text-xs'}>{t('revenueThisMonth')}</span>
                  </div>
                  <p className={'text-foreground text-lg font-semibold'}>
                    {revenueFormatter(data.revenueThisMonth)}
                  </p>
                </div>
                <div className={'bg-brand/10 rounded-xl p-3'}>
                  <div className={'mb-2 flex items-center gap-2'}>
                    <UserRoundCheck className={'text-brand h-4 w-4'} />
                    <span className={'text-muted-foreground text-xs'}>{t('revenueLastMonth')}</span>
                  </div>
                  <p className={'text-foreground text-lg font-semibold'}>
                    {revenueFormatter(data.revenueLastMonth)}
                  </p>
                </div>
              </div>

              <div className={'border-border mt-4 border-t pt-4'}>
                {monthlyRevenue.some((item) => item.value > 0) ? (
                  <BarChart data={monthlyRevenue} valueFormatter={revenueFormatter} />
                ) : (
                  <p className={'text-muted-foreground text-sm'}>{t('noData')}</p>
                )}
              </div>

              {data.revenueByService.length > 0 && (
                <div className={'border-border mt-4 border-t pt-4'}>
                  <p className={'text-foreground mb-3 text-sm font-medium'}>{t('byService')}</p>
                  <div className={'space-y-4'}>
                    {data.revenueByService.map((item) => (
                      <StatBar
                        key={item.name}
                        label={item.name}
                        value={item.revenue}
                        maxValue={revenueMax}
                        valueLabel={revenueFormatter(item.revenue)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
