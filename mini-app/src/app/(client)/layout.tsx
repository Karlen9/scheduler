"use client";

import { useEffect } from "react";
import { Home, Repeat, ClipboardList, User } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { initTelegramApp } from "@/lib/telegram";

const clientTabs = [
  { key: "home", label: "Главная", icon: Home, href: "/" },
  { key: "recurring", label: "Расписание", icon: Repeat, href: "/recurring" },
  { key: "bookings", label: "Записи", icon: ClipboardList, href: "/bookings" },
  { key: "profile", label: "Профиль", icon: User, href: "/profile" },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      <div className="pb-24">{children}</div>
      <BottomTabBar tabs={clientTabs} />
    </div>
  );
}
