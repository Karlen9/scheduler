"use client";

import { ReactNode } from "react";
import { ClipboardList, Users, Settings } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminTabs = [
  { key: "bookings", label: "Записи", icon: ClipboardList, href: "/admin" },
  { key: "clients", label: "Клиенты", icon: Users, href: "/admin/clients" },
  { key: "settings", label: "Настройки", icon: Settings, href: "/admin/settings" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div
      className="min-h-screen bg-background"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      <div className="pb-24">{children}</div>
      <BottomTabBar tabs={adminTabs} />
    </div>
  );
}
