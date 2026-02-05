"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Calendar, Settings } from "lucide-react";

export function AdminBottomNav() {
  const pathname = usePathname();

  const isSchedule = pathname === "/admin" || pathname === "/admin/";
  const isSettings = pathname.startsWith("/admin/settings");

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      <div className="flex justify-around items-center py-3">
        <Link
          href="/admin"
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
            isSchedule
              ? "text-brand"
              : "text-muted-foreground"
          }`}
        >
          <Calendar className="w-6 h-6" />
        </Link>

        <Link
          href="/admin/settings"
          className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
            isSettings
              ? "text-brand"
              : "text-muted-foreground"
          }`}
        >
          <Settings className="w-6 h-6" />
        </Link>
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
