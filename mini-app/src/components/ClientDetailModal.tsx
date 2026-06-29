'use client';

import { Bookmark } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { BottomSheet } from '@/components/BottomSheet';
import { ClientAvatar } from '@/components/ClientAvatar';
import { invalidateClientBatches } from '@/hooks/mutations';
import { useAdminClientBatches, useAdminServices } from '@/hooks/queries';
import { api } from '@/lib/api';

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
  const [showBatchAssign, setShowBatchAssign] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [assigningBatch, setAssigningBatch] = useState(false);
  const effectiveClientId = client?.id ?? retainedClient?.id;
  const { data: services } = useAdminServices();
  const { data: clientBatches, mutate: mutateClientBatches } =
    useAdminClientBatches(effectiveClientId);

  useEffect(() => {
    if (client) {
      setRetainedClient(client);
    }
  }, [client]);

  useEffect(() => {
    if (!isOpen) {
      setShowBatchAssign(false);
      setSelectedServiceId('');
    }
  }, [isOpen]);

  const displayClient = client ?? retainedClient;

  if (!displayClient) {
    return null;
  }

  const displayName = displayClient.displayName || displayClient.name;
  const canMessage =
    !displayClient.isGhost && !displayClient.isSelf && !!displayClient.telegramUsername;
  const batchServices = services.filter((service) => service.type === 'batch');
  const activeBatches = clientBatches.filter(
    (batch) => batch.status === 'active' && batch.remainingSessions > 0,
  );
  const canAssignBatch = batchServices.length > 0;

  const createdDate = new Date(displayClient.createdAt);
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const createdLabel = dateFormatter.format(createdDate);

  const handleAssignBatch = async (): Promise<void> => {
    if (!selectedServiceId) {
      return;
    }
    setAssigningBatch(true);
    try {
      await api.admin.assignClientBatch(displayClient.id, selectedServiceId);
      await mutateClientBatches();
      await invalidateClientBatches();
      setShowBatchAssign(false);
      setSelectedServiceId('');
      toast.success(t('batchAssignSuccess'));
    } catch (err) {
      console.error('Failed to assign batch:', err);
      toast.error(err instanceof Error ? err.message : t('batchAssignError'));
    } finally {
      setAssigningBatch(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} showClose>
      <div className={'mb-4 flex items-center gap-4'}>
        {displayClient.isSelf ? (
          <div
            className={'bg-brand flex h-16 w-16 shrink-0 items-center justify-center rounded-full'}
          >
            <Bookmark className={'h-8 w-8 fill-white text-white'} />
          </div>
        ) : (
          <ClientAvatar name={displayName} photoUrl={displayClient.photoUrl} size={'lg'} />
        )}
        <div className={'min-w-0'}>
          <h3 className={'text-foreground truncate text-xl font-medium'}>
            {displayClient.isSelf ? tc('self') : displayName}
          </h3>
          {displayClient.displayName && !displayClient.isGhost && !displayClient.isSelf && (
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

      <div className={'mt-3 space-y-3'}>
        {activeBatches.length > 0 && (
          <div className={'bg-card rounded-xl p-3'}>
            <div className={'text-muted-foreground mb-2 text-xs font-medium'}>
              {t('activeBatches')}
            </div>
            <div className={'space-y-2'}>
              {activeBatches.map((batch) => (
                <div key={batch.id} className={'flex items-center justify-between gap-3 text-sm'}>
                  <span className={'text-foreground min-w-0 truncate'}>
                    {batch.service?.name ?? t('batchFallbackName')}
                  </span>
                  <span className={'text-muted-foreground shrink-0'}>
                    {t('batchRemainingShort', {
                      remaining: batch.remainingSessions,
                      total: batch.totalSessions,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showBatchAssign ? (
          <button
            type={'button'}
            onClick={() => {
              setShowBatchAssign(true);
              setSelectedServiceId(batchServices[0]?.id ?? '');
            }}
            disabled={!canAssignBatch}
            className={
              'bg-card text-foreground w-full rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50'
            }
          >
            {t('addBatch')}
          </button>
        ) : (
          <div className={'bg-card space-y-3 rounded-xl p-3'}>
            <label className={'text-muted-foreground block text-sm'}>
              {t('batchServiceLabel')}
            </label>
            <select
              value={selectedServiceId}
              onChange={(event) => setSelectedServiceId(event.target.value)}
              className={
                'bg-background text-foreground focus:ring-brand w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2'
              }
            >
              {batchServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <div className={'grid grid-cols-2 gap-2'}>
              <button
                type={'button'}
                onClick={() => setShowBatchAssign(false)}
                disabled={assigningBatch}
                className={
                  'bg-background text-foreground rounded-[24px] px-4 py-2.5 text-sm font-medium disabled:opacity-50'
                }
              >
                {tc('cancel')}
              </button>
              <button
                type={'button'}
                onClick={handleAssignBatch}
                disabled={!selectedServiceId || assigningBatch}
                className={
                  'bg-brand rounded-[24px] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50'
                }
              >
                {assigningBatch ? tc('saving') : tc('confirm')}
              </button>
            </div>
          </div>
        )}
      </div>

      {!displayClient.isGhost &&
        !displayClient.isSelf &&
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
