'use client';

import { Pencil, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ActivityBackButton } from '@/components/ActivityBackButton';
import { ClientAvatar } from '@/components/ClientAvatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { invalidateBookings, invalidateClients, invalidateRecurring } from '@/hooks/mutations';
import { useClients } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { TClientInfo } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the admin clients page UI and related interactions.
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
export default function AdminClientsPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminClients');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  const { data: clients, isLoading } = useClients();
  const [deleteTarget, setDeleteTarget] = useState<TClientInfo | null>(null);
  const [editTarget, setEditTarget] = useState<TClientInfo | null>(null);
  const [editName, setEditName] = useState('');

  /***************************************************************************************************
   * Handles delete.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }
    try {
      await api.admin.deleteClient(deleteTarget.id);
      invalidateClients();
      toast.success(t('deleteSuccess', { name: deleteTarget.name }));
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      const msg = err instanceof Error ? err.message : t('deleteError');
      toast.error(msg);
    }
    setDeleteTarget(null);
  };

  /***************************************************************************************************
   * Handles edit.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEdit = (client: TClientInfo): void => {
    setEditTarget(client);
    setEditName(client.isGhost ? client.name : client.displayName || client.name);
  };

  /***************************************************************************************************
   * Handles edit confirm.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleEditConfirm = async (): Promise<void> => {
    if (!editTarget) {
      return;
    }
    /***************************************************************************************************
     * Defines the trimmed value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const trimmed = editName.trim();
    if (!trimmed) {
      return;
    }
    try {
      await api.admin.updateClient(editTarget.id, trimmed);
      invalidateClients();
      invalidateBookings();
      invalidateRecurring();
      toast.success(t('renameSuccess'));
    } catch (err) {
      /***************************************************************************************************
       * Defines the msg value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      const msg = err instanceof Error ? err.message : t('renameError');
      toast.error(msg);
    }
    setEditTarget(null);
  };

  /***************************************************************************************************
   * Defines the client display name value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const clientDisplayName = (client: TClientInfo): string => client.displayName || client.name;

  if (isLoading) {
    return (
      <div>
        <ActivityBackButton href={'/admin'} />
        <div className={'space-y-3 p-4'}>
          <h2 className={'text-lg font-semibold'}>{t('title')}</h2>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={'bg-card flex animate-pulse items-center gap-3 rounded-xl p-4'}>
              <div className={'bg-border h-10 w-10 rounded-full'} />
              <div className={'flex-1 space-y-2'}>
                <div className={'bg-border h-4 w-1/2 rounded'} />
                <div className={'bg-border h-3 w-1/3 rounded'} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className={'flex flex-1 flex-col'}>
        <ActivityBackButton href={'/admin'} />
        <div className={'p-4'}>
          <h2 className={'text-lg font-semibold'}>{t('title')}</h2>
        </div>
        <div className={'flex min-h-[300px] flex-1 items-center justify-center'}>
          <EmptyState
            icon={<Users className={'h-16 w-16'} />}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ActivityBackButton href={'/admin'} />
      <div className={'space-y-3 p-4'}>
        <h2 className={'text-lg font-semibold'}>{t('title')}</h2>
        {clients.map((client) => (
          <div key={client.id} className={'bg-card flex items-center gap-3 rounded-xl p-4'}>
            <ClientAvatar name={clientDisplayName(client)} photoUrl={client.photoUrl} size={'md'} />
            <div className={'min-w-0 flex-1'}>
              <div className={'text-foreground truncate font-medium'}>
                {clientDisplayName(client)}
                {client.isGhost && (
                  <span className={'text-muted-foreground ml-1.5 text-xs font-normal'}>
                    {tc('ghost')}
                  </span>
                )}
              </div>
              {client.displayName && !client.isGhost && (
                <div className={'text-muted-foreground truncate text-xs'}>{client.name}</div>
              )}
              {client.phone && (
                <div className={'text-muted-foreground text-sm'}>{client.phone}</div>
              )}
            </div>
            <button
              onClick={() => handleEdit(client)}
              className={'text-muted-foreground active:bg-card rounded-lg p-2 transition-colors'}
            >
              <Pencil className={'h-4 w-4'} />
            </button>
            <button
              onClick={() => setDeleteTarget(client)}
              className={'text-muted-foreground active:bg-card rounded-lg p-2 transition-colors'}
            >
              <Trash2 className={'h-4 w-4'} />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onConfirm={handleEditConfirm}
        title={t('renameDialog')}
        confirmText={tc('save')}
        showInput
        inputValue={editName}
        onInputChange={setEditName}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('deleteDialog')}
        description={t('deleteDialogDescription', { name: deleteTarget?.name || '' })}
        confirmText={t('deleteConfirm')}
        destructive
      />
    </div>
  );
}
