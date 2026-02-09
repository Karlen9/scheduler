"use client";

import { useEffect } from "react";
import { CalendarPlus, ClipboardList, User } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { initTelegramApp } from "@/lib/telegram";

const clientTabs = [
  { key: "book", label: "Запись", icon: CalendarPlus, href: "/book" },
  { key: "bookings", label: "Мои записи", icon: ClipboardList, href: "/bookings" },
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
