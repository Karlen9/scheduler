'use client';

import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ClientAvatar } from '@/components/ClientAvatar';
import { ClientDetailModal } from '@/components/ClientDetailModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { invalidateBookings, invalidateClients, invalidateRecurring } from '@/hooks/mutations';
import { useClients } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { getTelegramWebApp } from '@/lib/telegram';

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
  const router = useRouter();
  const t = useTranslations('AdminClients');
  const tc = useTranslations('Common');
  const { data: clients, isLoading } = useClients();
  const [deleteTarget, setDeleteTarget] = useState<TClientInfo | null>(null);
  const [editTarget, setEditTarget] = useState<TClientInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [selectedClient, setSelectedClient] = useState<TClientInfo | null>(null);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [bookingsCountLoading, setBookingsCountLoading] = useState(false);

  useEffect(() => {
    if (!selectedClient) {
      return;
    }
    setBookingsCountLoading(true);
    api.admin
      .getBookingsPage({ page: 1, limit: 1, clientId: selectedClient.id })
      .then((res) => setBookingsCount(res.total))
      .catch(() => setBookingsCount(0))
      .finally(() => setBookingsCountLoading(false));
  }, [selectedClient]);

  const handleMessageClient = (client: TClientInfo): void => {
    if (client.isGhost || client.telegramUserId <= 0) {
      toast.error(t('dmUnavailable'));
      return;
    }
    const url = `tg://user?id=${client.telegramUserId}`;
    try {
      const webApp = getTelegramWebApp();
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(url);
      } else {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  };

  const handleViewBookings = (client: TClientInfo): void => {
    setSelectedClient(null);
    router.push(`/admin/bookings?clientId=${client.id}`);
  };

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
   * Handles add client confirm.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleAddClientConfirm = async (): Promise<void> => {
    const trimmed = newClientName.trim();
    if (!trimmed) {
      toast.error(t('nameRequired'));
      return;
    }
    try {
      setIsAddingClient(true);
      await api.admin.createGhostClient(trimmed);
      await invalidateClients();
      toast.success(t('createSuccess', { name: trimmed }));
      setNewClientName('');
      setAddClientOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('createError');
      toast.error(msg);
    } finally {
      setIsAddingClient(false);
    }
  };

  /***************************************************************************************************
   * Defines the client display name value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const clientDisplayName = (client: TClientInfo): string => client.displayName || client.name;

  const filteredClients = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) {
      return clients;
    }
    return clients.filter((client) =>
      [clientDisplayName(client), client.name, client.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [clients, debouncedSearchQuery]);

  const header = (
    <div className={'space-y-3'}>
      <div className={'flex items-center justify-between gap-3'}>
        <h2 className={'text-lg font-semibold'}>{t('title')}</h2>
        <button
          type={'button'}
          onClick={() => setAddClientOpen(true)}
          className={
            'bg-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-opacity active:opacity-80'
          }
          aria-label={t('addClient')}
        >
          <Plus className={'h-5 w-5'} />
        </button>
      </div>
      <label className={'relative block'}>
        <Search
          className={
            'text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'
          }
        />
        <input
          type={'search'}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className={
            'bg-card text-foreground placeholder:text-muted-foreground w-full rounded-lg py-3 pr-4 pl-10 text-sm outline-none'
          }
        />
      </label>
    </div>
  );

  const addClientDialog = (
    <Transition show={addClientOpen} appear as={Fragment}>
      <Dialog
        onClose={() => {
          if (!isAddingClient) {
            setAddClientOpen(false);
            setNewClientName('');
          }
        }}
        className={'relative z-[100]'}
      >
        <TransitionChild
          as={Fragment}
          enter={'ease-out duration-200'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-150'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/50'} aria-hidden={'true'} />
        </TransitionChild>
        <div className={'fixed inset-0 flex items-center justify-center p-4'}>
          <TransitionChild
            as={Fragment}
            enter={'ease-out duration-200'}
            enterFrom={'scale-95 opacity-0'}
            enterTo={'scale-100 opacity-100'}
            leave={'ease-in duration-150'}
            leaveFrom={'scale-100 opacity-100'}
            leaveTo={'scale-95 opacity-0'}
          >
            <DialogPanel className={'bg-card w-full max-w-sm rounded-2xl p-6 shadow-lg'}>
              <div className={'mb-4 flex items-center justify-between gap-3'}>
                <DialogTitle className={'text-foreground text-lg font-medium'}>
                  {t('addDialog')}
                </DialogTitle>
                <button
                  type={'button'}
                  onClick={() => {
                    setAddClientOpen(false);
                    setNewClientName('');
                  }}
                  disabled={isAddingClient}
                  className={'text-muted-foreground rounded-lg p-1 disabled:opacity-40'}
                >
                  <X className={'h-5 w-5'} />
                </button>
              </div>
              <p className={'text-muted-foreground mb-4 text-sm'}>{t('addDialogDescription')}</p>
              <form
                className={'space-y-4'}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAddClientConfirm();
                }}
              >
                <input
                  type={'text'}
                  value={newClientName}
                  onChange={(event) => setNewClientName(event.target.value)}
                  placeholder={t('namePlaceholder')}
                  disabled={isAddingClient}
                  className={
                    'bg-background text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60'
                  }
                />
                <div className={'flex gap-3'}>
                  <button
                    type={'button'}
                    onClick={() => {
                      setAddClientOpen(false);
                      setNewClientName('');
                    }}
                    disabled={isAddingClient}
                    className={
                      'bg-card text-foreground flex-1 rounded-xl px-4 py-3 text-base font-medium transition-opacity active:opacity-70 disabled:opacity-40'
                    }
                  >
                    {tc('cancel')}
                  </button>
                  <button
                    type={'submit'}
                    disabled={isAddingClient}
                    className={
                      'bg-brand flex-1 rounded-xl px-4 py-3 text-base font-medium text-white transition-opacity active:opacity-70 disabled:opacity-40'
                    }
                  >
                    {t('addClient')}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );

  if (isLoading) {
    return (
      <div>
        <div className={'space-y-3 p-4'}>
          <h2 className={'text-lg font-semibold'}>{t('title')}</h2>
          <div className={'bg-card h-11 rounded-lg'} />
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
        <div className={'p-4'}>{header}</div>
        <div className={'flex min-h-[300px] flex-1 items-center justify-center'}>
          <EmptyState
            icon={<Users className={'h-16 w-16'} />}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        </div>
        {addClientDialog}
      </div>
    );
  }

  return (
    <div>
      <div className={'space-y-3 p-4'}>
        {header}
        {filteredClients.length === 0 && (
          <div className={'flex min-h-[240px] items-center justify-center'}>
            <EmptyState
              icon={<Search className={'h-16 w-16'} />}
              title={t('emptySearchTitle')}
              description={t('emptySearchDescription')}
            />
          </div>
        )}
        {filteredClients.map((client) => (
          <button
            key={client.id}
            type={'button'}
            onClick={() => setSelectedClient(client)}
            className={
              'bg-card flex w-full items-center gap-3 rounded-xl p-4 text-left active:opacity-80'
            }
          >
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
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(client);
              }}
              className={'text-muted-foreground active:bg-card rounded-lg p-2 transition-colors'}
            >
              <Pencil className={'h-4 w-4'} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(client);
              }}
              className={'text-muted-foreground active:bg-card rounded-lg p-2 transition-colors'}
            >
              <Trash2 className={'h-4 w-4'} />
            </button>
          </button>
        ))}
      </div>

      {addClientDialog}

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

      <ClientDetailModal
        client={selectedClient}
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        onMessageClient={handleMessageClient}
        onViewBookings={handleViewBookings}
        bookingsCount={bookingsCount}
        bookingsCountLoading={bookingsCountLoading}
      />
    </div>
  );
}
