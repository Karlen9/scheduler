'use client';

import { Clock, Copy, Gift, Send, UserCircle2, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { TopBar } from '@/components/TopBar';
import { useAdminReferrals } from '@/hooks/queries';
import { getTelegramWebApp } from '@/lib/telegram';

import type { TReferredSpecialist } from '@/lib/types';
import type { ReactNode } from 'react';

export default function ReferralsPage(): ReactNode {
  const t = useTranslations('AdminReferrals');
  const locale = useLocale();
  const { data, isLoading } = useAdminReferrals();

  const link = data?.link ?? '';
  const specialists = data?.specialists ?? [];
  const activeCount = data?.activeCount ?? 0;
  const pendingCount = data?.passiveCount ?? 0;
  const rewardDays = data?.rewardDays ?? 30;

  const active = specialists
    .filter((s) => s.isActive)
    .sort((a, b) => (b.firstPaymentAt ?? '').localeCompare(a.firstPaymentAt ?? ''));
  const pending = specialists
    .filter((s) => !s.isActive)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!link) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const el = document.createElement('textarea');
        el.value = link;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }, [link, t]);

  const handleShareTelegram = useCallback((): void => {
    if (!link) {
      return;
    }
    const message = t('shareText').trim();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
    const webApp = getTelegramWebApp();
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  }, [link, t]);

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const bothEmpty = active.length === 0 && pending.length === 0;

  return (
    <div>
      <TopBar title={t('title')} showBack />
      <div className={'space-y-4 p-4'}>
        <div className={'bg-card rounded-xl p-4'}>
          <div className={'flex items-start gap-3'}>
            <div
              className={
                'bg-brand/15 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
              }
            >
              <Gift className={'h-5 w-5'} />
            </div>
            <div className={'flex-1'}>
              <h2 className={'text-foreground text-base font-medium'}>{t('heroHeading')}</h2>
              <p className={'text-muted-foreground mt-1 text-sm leading-relaxed'}>
                {t('heroBody')}
              </p>
            </div>
          </div>
        </div>

        <div className={'bg-card rounded-xl p-4'}>
          <h3 className={'text-foreground mb-3 text-[15px] font-medium'}>
            {t('howItWorksHeading')}
          </h3>
          <div className={'space-y-3'}>
            {([t('step1'), t('step2'), t('step3', { days: rewardDays })] as string[]).map(
              (step, i) => (
                <div key={i} className={'flex items-start gap-3'}>
                  <div
                    className={
                      'bg-brand/15 text-brand flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
                    }
                  >
                    {i + 1}
                  </div>
                  <div className={'text-foreground text-sm'}>{step}</div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className={'bg-card rounded-xl p-4'}>
          <p className={'text-muted-foreground mb-2 text-xs tracking-wide uppercase'}>
            {t('yourLink')}
          </p>
          <div
            className={
              'bg-surface-hover text-foreground rounded-lg px-3 py-2 font-mono text-sm break-all'
            }
          >
            {isLoading || !link ? '…' : link}
          </div>
          <div className={'mt-3 flex gap-2'}>
            <button
              type={'button'}
              onClick={handleCopy}
              disabled={!link}
              className={
                'bg-surface-hover text-foreground active:bg-border flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50'
              }
            >
              <Copy className={'h-4 w-4'} />
              {t('copyLink')}
            </button>
            <button
              type={'button'}
              onClick={handleShareTelegram}
              disabled={!link}
              className={
                'bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50'
              }
            >
              <Send className={'h-4 w-4'} />
              {t('shareTelegram')}
            </button>
          </div>
        </div>

        <div className={'grid grid-cols-2 gap-3'}>
          <StatTile
            icon={<Users className={'h-5 w-5'} />}
            accent={'success'}
            label={t('statsActive')}
            value={activeCount}
          />
          <StatTile
            icon={<Clock className={'h-5 w-5'} />}
            accent={'muted'}
            label={t('statsPending')}
            value={pendingCount}
          />
        </div>

        {bothEmpty ? (
          <div className={'bg-card text-muted-foreground rounded-xl px-4 py-8 text-center text-sm'}>
            {t('listEmpty')}
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <SpecialistSection
                title={t('sectionActive')}
                items={active}
                dateLabel={(s) =>
                  t('activatedOn', { date: formatDate(s.firstPaymentAt ?? s.createdAt) })
                }
              />
            )}
            {pending.length > 0 && (
              <SpecialistSection
                title={t('sectionPending')}
                items={pending}
                dateLabel={(s) => t('joinedOn', { date: formatDate(s.createdAt) })}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon,
  accent,
  label,
  value,
}: {
  icon: ReactNode;
  accent: 'success' | 'muted';
  label: string;
  value: number;
}): ReactNode {
  const accentClasses =
    accent === 'success' ? 'bg-success/15 text-success' : 'bg-surface-hover text-muted-foreground';
  return (
    <div className={'bg-card rounded-xl p-4'}>
      <div className={'flex items-center gap-3'}>
        <div className={`${accentClasses} flex h-10 w-10 items-center justify-center rounded-lg`}>
          {icon}
        </div>
        <div className={'min-w-0'}>
          <div className={'text-muted-foreground text-xs tracking-wide uppercase'}>{label}</div>
          <div className={'text-foreground text-2xl font-semibold tabular-nums'}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function SpecialistSection({
  title,
  items,
  dateLabel,
}: {
  title: string;
  items: TReferredSpecialist[];
  dateLabel: (s: TReferredSpecialist) => string;
}): ReactNode {
  return (
    <div>
      <h3 className={'text-muted-foreground mb-2 px-1 text-xs tracking-wide uppercase'}>{title}</h3>
      <div className={'bg-card divide-border divide-y overflow-hidden rounded-xl'}>
        {items.map((s) => (
          <SpecialistRow key={s.id} item={s} subtitle={dateLabel(s)} />
        ))}
      </div>
    </div>
  );
}

function SpecialistRow({
  item,
  subtitle,
}: {
  item: TReferredSpecialist;
  subtitle: string;
}): ReactNode {
  return (
    <div className={'flex items-center gap-3 px-4 py-3'}>
      <div
        className={
          'bg-surface-hover text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full'
        }
      >
        <UserCircle2 className={'h-5 w-5'} />
      </div>
      <div className={'min-w-0 flex-1'}>
        <div className={'text-foreground truncate text-sm font-medium'}>{item.name}</div>
        <div className={'text-muted-foreground truncate text-xs'}>
          {item.botUsername ? `@${item.botUsername} · ${subtitle}` : subtitle}
        </div>
      </div>
    </div>
  );
}
