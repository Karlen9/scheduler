'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { ClientAvatar } from '@/components/ClientAvatar';

import type { TClientDetailModalProps, TClientInfo } from '@/lib/types';
import type { ReactNode } from 'react';

export function ClientDetailModal({
  client,
  isOpen,
  onClose,
  onMessageClient,
  onViewBookings,
  onBlockClient,
  onUnblockClient,
  bookingsCount,
  bookingsCountLoading,
}: TClientDetailModalProps): ReactNode {
  const t = useTranslations('AdminClients');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const [retainedClient, setRetainedClient] = useState<TClientInfo | null>(client);

  useEffect(() => {
    if (client) {
      setRetainedClient(client);
    }
  }, [client]);

  const displayClient = client ?? retainedClient;

  if (!displayClient) {
    return null;
  }

  const displayName = displayClient.displayName || displayClient.name;
  const canMessage = !displayClient.isGhost && !!displayClient.telegramUsername;

  const createdDate = new Date(displayClient.createdAt);
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const createdLabel = dateFormatter.format(createdDate);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} showClose>
      <div className={'mb-4 flex items-center gap-4'}>
        <ClientAvatar name={displayName} photoUrl={displayClient.photoUrl} size={'lg'} />
        <div className={'min-w-0'}>
          <h3 className={'text-foreground truncate text-xl font-medium'}>{displayName}</h3>
          {displayClient.displayName && !displayClient.isGhost && (
            <div className={'text-muted-foreground truncate text-sm'}>{displayClient.name}</div>
          )}
          {displayClient.isGhost && (
            <span className={'text-muted-foreground text-sm'}>{tc('ghost')}</span>
          )}
        </div>
      </div>

      <div className={'mb-6 space-y-3'}>
        {displayClient.phone && (
          <div className={'border-border flex justify-between border-b py-2'}>
            <span className={'text-muted-foreground'}>{t('phoneLabel')}</span>
            <span className={'text-foreground font-medium'}>{displayClient.phone}</span>
          </div>
        )}
        <div className={'border-border flex justify-between border-b py-2'}>
          <span className={'text-muted-foreground'}>{t('createdLabel')}</span>
          <span className={'text-foreground font-medium'}>{createdLabel}</span>
        </div>
      </div>

      {canMessage && (
        <button
          onClick={() => onMessageClient(displayClient)}
          className={
            'bg-card text-foreground mb-3 w-full rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
          }
        >
          {t('messageClient')}
        </button>
      )}

      <button
        onClick={() => onViewBookings(displayClient)}
        className={
          'bg-brand w-full rounded-[28px] px-4 py-3 text-sm font-medium text-white transition-opacity active:opacity-80'
        }
      >
        {bookingsCountLoading
          ? t('bookingsHistory', { count: '...' })
          : t('bookingsHistory', { count: bookingsCount })}
      </button>

      {!displayClient.isGhost &&
        (displayClient.isBlocked
          ? onUnblockClient && (
              <button
                onClick={() => onUnblockClient(displayClient)}
                className={
                  'bg-card text-foreground mt-3 w-full rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                }
              >
                {t('unblockClient')}
              </button>
            )
          : onBlockClient && (
              <button
                onClick={() => onBlockClient(displayClient)}
                className={
                  'bg-action-danger-bg text-action-danger-text mt-3 w-full rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                }
              >
                {t('blockClient')}
              </button>
            ))}
    </BottomSheet>
  );
}
