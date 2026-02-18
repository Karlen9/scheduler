'use client';

import { useState } from 'react';
import { Users, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ActivityBackButton } from '@/components/ActivityBackButton';
import { EmptyState } from '@/components/EmptyState';
import { ClientAvatar } from '@/components/ClientAvatar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ClientInfo } from '@/lib/types';
import { api } from '@/lib/api';
import { useClients } from '@/hooks/queries';
import { invalidateClients, invalidateBookings, invalidateRecurring } from '@/hooks/mutations';

export default function AdminClientsPage() {
  const t = useTranslations('AdminClients');
  const tc = useTranslations('Common');
  const { data: clients, isLoading } = useClients();
  const [deleteTarget, setDeleteTarget] = useState<ClientInfo | null>(null);
  const [editTarget, setEditTarget] = useState<ClientInfo | null>(null);
  const [editName, setEditName] = useState('');

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.deleteClient(deleteTarget.id);
      invalidateClients();
      toast.success(t('deleteSuccess', { name: deleteTarget.name }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('deleteError');
      toast.error(msg);
    }
    setDeleteTarget(null);
  };

  const handleEdit = (client: ClientInfo) => {
    setEditTarget(client);
    setEditName(client.isGhost ? client.name : client.displayName || client.name);
  };

  const handleEditConfirm = async () => {
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await api.admin.updateClient(editTarget.id, trimmed);
      invalidateClients();
      invalidateBookings();
      invalidateRecurring();
      toast.success(t('renameSuccess'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('renameError');
      toast.error(msg);
    }
    setEditTarget(null);
  };

  const clientDisplayName = (client: ClientInfo) => client.displayName || client.name;

  if (isLoading) {
    return (
      <div>
        <ActivityBackButton href="/admin" />
        <div className="space-y-3 p-4">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card flex animate-pulse items-center gap-3 rounded-xl p-4">
              <div className="bg-border h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-border h-4 w-1/2 rounded" />
                <div className="bg-border h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <ActivityBackButton href="/admin" />
        <div className="p-4">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
        </div>
        <div className="flex min-h-[300px] flex-1 items-center justify-center">
          <EmptyState
            icon={<Users className="h-16 w-16" />}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ActivityBackButton href="/admin" />
      <div className="space-y-3 p-4">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        {clients.map((client) => (
          <div key={client.id} className="bg-card flex items-center gap-3 rounded-xl p-4">
            <ClientAvatar name={clientDisplayName(client)} photoUrl={client.photoUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate font-medium">
                {clientDisplayName(client)}
                {client.isGhost && (
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                    {tc('ghost')}
                  </span>
                )}
              </div>
              {client.displayName && !client.isGhost && (
                <div className="text-muted-foreground truncate text-xs">{client.name}</div>
              )}
              {client.phone && <div className="text-muted-foreground text-sm">{client.phone}</div>}
            </div>
            <button
              onClick={() => handleEdit(client)}
              className="text-muted-foreground active:bg-card rounded-lg p-2 transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(client)}
              className="text-muted-foreground active:bg-card rounded-lg p-2 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
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
