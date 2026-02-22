import { AlertCircle, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ClientAvatar } from '../ClientAvatar';
import { EmptyState } from '../EmptyState';

import type { TClientInfo } from '@/lib/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

export type TClientSelectorProps = {
  clients?: TClientInfo[];
  selectedClient: TClientInfo | null;
  onCreateGhostClient: ((name: string) => Promise<TClientInfo>) | undefined;
  setSelectedClient: Dispatch<SetStateAction<TClientInfo | null>>;
};

export function ClientSelector({
  selectedClient,
  onCreateGhostClient,
  clients,
  setSelectedClient,
}: TClientSelectorProps): ReactNode {
  const t = useTranslations('BookingForm');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingGhost, setIsCreatingGhost] = useState(false);

  const handleCreateGhostClient = async (): Promise<void> => {
    if (!onCreateGhostClient || !searchQuery.trim()) {
      return;
    }
    setIsCreatingGhost(true);
    try {
      const client = await onCreateGhostClient(searchQuery.trim());
      setSelectedClient(client);
      setSearchQuery('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : te('clientCreateFailed');
      toast.error(msg);
    } finally {
      setIsCreatingGhost(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clients) {
      return [];
    }
    if (!searchQuery.trim()) {
      return clients;
    }
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.displayName && c.displayName.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)),
    );
  }, [clients, searchQuery]);

  const hasClientSelector = !!clients;
  return (
    <>
      {/* Client Selector (admin only) */}
      {hasClientSelector && !selectedClient && (
        <div>
          <label className={'text-muted-foreground mb-2 block text-sm'}>{t('selectClient')}</label>
          <div className={'relative mb-3'}>
            <Search
              className={'text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'}
            />
            <input
              type={'text'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchByNameOrPhone')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg py-3 pr-4 pl-10 text-sm outline-none focus:ring-2'
              }
            />
          </div>
          {filteredClients.length === 0 ? (
            <div className={'space-y-3'}>
              {onCreateGhostClient && searchQuery.trim() && (
                <button
                  onClick={handleCreateGhostClient}
                  disabled={isCreatingGhost}
                  className={
                    'border-border text-muted-foreground active:bg-card w-full rounded-xl border-2 border-dashed p-4 text-sm transition-colors disabled:opacity-50'
                  }
                >
                  {isCreatingGhost ? tc('creating') : t('addClient', { name: searchQuery.trim() })}
                </button>
              )}
              <EmptyState
                icon={<AlertCircle className={'h-16 w-16'} />}
                title={t('clientsNotFound')}
                description={
                  clients!.length === 0 ? t('noRegisteredClients') : t('changeSearchQuery')
                }
              />
            </div>
          ) : (
            <div className={'space-y-2'}>
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClient(client);
                    setSearchQuery('');
                  }}
                  className={
                    'bg-card flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors'
                  }
                >
                  <ClientAvatar
                    name={client.displayName || client.name}
                    photoUrl={client.photoUrl}
                  />
                  <div className={'min-w-0 flex-1'}>
                    <div className={'text-foreground truncate font-medium'}>
                      {client.displayName || client.name}
                      {client.isGhost && (
                        <span className={'text-muted-foreground ml-1.5 text-xs font-normal'}>
                          {tc('ghost')}
                        </span>
                      )}
                    </div>
                    {client.phone && (
                      <div className={'text-muted-foreground text-sm'}>{client.phone}</div>
                    )}
                  </div>
                </button>
              ))}
              {onCreateGhostClient &&
                searchQuery.trim() &&
                !filteredClients.some(
                  (c) => c.name.toLowerCase() === searchQuery.trim().toLowerCase(),
                ) && (
                  <button
                    onClick={handleCreateGhostClient}
                    disabled={isCreatingGhost}
                    className={
                      'border-border text-muted-foreground active:bg-card w-full rounded-xl border-2 border-dashed p-4 text-sm transition-colors disabled:opacity-50'
                    }
                  >
                    {isCreatingGhost
                      ? tc('creating')
                      : t('addClient', { name: searchQuery.trim() })}
                  </button>
                )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
