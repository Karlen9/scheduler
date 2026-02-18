"use client";

import { useState } from "react";
import { Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ActivityBackButton } from "@/components/ActivityBackButton";
import { EmptyState } from "@/components/EmptyState";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ClientInfo } from "@/lib/types";
import { api } from "@/lib/api";
import { useClients } from "@/hooks/queries";
import { invalidateClients } from "@/hooks/mutations";

export default function AdminClientsPage() {
  const t = useTranslations("AdminClients");
  const tc = useTranslations("Common");
  const te = useTranslations("Errors");
  const ts = useTranslations("Success");
  const { data: clients, isLoading } = useClients();
  const [deleteTarget, setDeleteTarget] = useState<ClientInfo | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.deleteClient(deleteTarget.id);
      invalidateClients();
      toast.success(t("deleteSuccess", { name: deleteTarget.name }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("deleteError");
      toast.error(msg);
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div>
        <ActivityBackButton href="/admin" />
        <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 animate-pulse flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-border" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-border rounded w-1/2" />
              <div className="h-3 bg-border rounded w-1/3" />
            </div>
          </div>
        ))}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <ActivityBackButton href="/admin" />
        <div className="p-4">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ActivityBackButton href="/admin" />
      <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {clients.map((client) => (
        <div
          key={client.id}
          className="bg-card rounded-xl p-4 flex items-center gap-3"
        >
          <ClientAvatar name={client.name} photoUrl={client.photoUrl} size="md" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground truncate">
              {client.name}
              {client.isGhost && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">{tc("ghost")}</span>
              )}
            </div>
            {client.phone && (
              <div className="text-sm text-muted-foreground">{client.phone}</div>
            )}
          </div>
          <button
            onClick={() => setDeleteTarget(client)}
            className="p-2 rounded-lg text-muted-foreground transition-colors active:bg-card"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("deleteDialog")}
        description={t("deleteDialogDescription", { name: deleteTarget?.name || "" })}
        confirmText={t("deleteConfirm")}
        destructive
      />
    </div>
  );
}
