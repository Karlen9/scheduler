"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { ClientInfo } from "@/lib/types";
import { getAvatarColor } from "@/lib/colors";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.admin
      .getClients()
      .then(setClients)
      .catch((err) => console.error("Failed to load clients:", err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">Клиенты</h2>
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
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Клиенты</h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title="Пока нет клиентов"
            description="Клиенты появятся здесь после первой записи"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">Клиенты</h2>
      {clients.map((client) => (
        <div
          key={client.id}
          className="bg-card rounded-xl p-4 flex items-center gap-3"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${getAvatarColor(client.name)}`}>
            {client.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground truncate">
              {client.name}
            </div>
            {client.phone && (
              <div className="text-sm text-muted-foreground">{client.phone}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
