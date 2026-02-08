"use client";

import { Bell } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { EmptyState } from "@/components/EmptyState";

export default function NotificationsPage() {
  return (
    <div>
      <TopBar title="Уведомления" showBack />

      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={<Bell className="w-16 h-16" />}
          title="Скоро будет доступно"
          description="Настройки уведомлений появятся в ближайшем обновлении"
        />
      </div>
    </div>
  );
}
