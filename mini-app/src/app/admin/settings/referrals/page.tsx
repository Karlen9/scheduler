'use client';

import { Copy, Gift, Send, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { ClientAvatar } from '@/components/ClientAvatar';
import { TopBar } from '@/components/TopBar';
import { useAdminReferrals } from '@/hooks/queries';
import { getTelegramWebApp } from '@/lib/telegram';

import type { TReferralClient } from '@/lib/types';
import type { ReactNode } from 'react';

export default function ReferralsPage(): ReactNode {
  const t = useTranslations('AdminReferrals');
  const locale = useLocale();
  const { data, isLoading } = useAdminReferrals();

  const link = data?.link ?? '';
  const referrals = data?.referrals ?? [];
  const count = data?.count ?? 0;

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
    const message = t('shareText', { link: '' }).trim();
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

        <div className={'bg-card flex items-center justify-between rounded-xl p-4'}>
          <div className={'flex items-center gap-3'}>
            <div
              className={
                'bg-success/15 text-success flex h-10 w-10 items-center justify-center rounded-lg'
              }
            >
              <Users className={'h-5 w-5'} />
            </div>
            <span className={'text-foreground text-sm'}>{t('statsCount')}</span>
          </div>
          <span className={'text-foreground text-2xl font-semibold tabular-nums'}>{count}</span>
        </div>

        <div>
          <h3 className={'text-muted-foreground mb-2 px-1 text-xs tracking-wide uppercase'}>
            {t('referralsTitle')}
          </h3>
          {referrals.length === 0 ? (
            <div
              className={'bg-card text-muted-foreground rounded-xl px-4 py-8 text-center text-sm'}
            >
              {t('referralsEmpty')}
            </div>
          ) : (
            <div className={'bg-card divide-border divide-y overflow-hidden rounded-xl'}>
              {referrals.map((r) => (
                <ReferralRow
                  key={r.id}
                  item={r}
                  formatDate={formatDate}
                  blockedLabel={t('blocked')}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferralRow({
  item,
  formatDate,
  blockedLabel,
}: {
  item: TReferralClient;
  formatDate: (iso: string) => string;
  blockedLabel: string;
}): ReactNode {
  const displayName = item.displayName || item.name;
  return (
    <div className={'flex items-center gap-3 px-4 py-3'}>
      <ClientAvatar name={displayName} photoUrl={item.photoUrl} size={'md'} />
      <div className={'min-w-0 flex-1'}>
        <div className={'text-foreground truncate text-sm font-medium'}>{displayName}</div>
        <div className={'text-muted-foreground truncate text-xs'}>{formatDate(item.createdAt)}</div>
      </div>
      {item.isBlocked && (
        <span className={'bg-error/15 text-error rounded px-2 py-0.5 text-xs'}>{blockedLabel}</span>
      )}
    </div>
  );
}
