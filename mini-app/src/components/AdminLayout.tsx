"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, User, ClipboardList, UserPlus, Repeat } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";
import { getTelegramWebApp } from "@/lib/telegram";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminTabs = [
  { key: "home", label: "Главная", icon: Home, href: "/admin" },
  { key: "bookings", label: "", icon: Plus, href: "/admin/bookings", isCenter: true, matchPaths: ["/admin/bookings", "/admin/book", "/admin/recurring"] },
  { key: "profile", label: "Профиль", icon: User, href: "/admin/settings" },
];

const adminSubTabs = [
  { icon: ClipboardList, href: "/admin/bookings" },
  { icon: UserPlus, href: "/admin/book" },
  { icon: Repeat, href: "/admin/recurring" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/admin" || pathname === "/admin/";

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) return;

    if (isHome) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
      const handler = () => router.push("/admin");
      webApp.BackButton.onClick(handler);
      return () => webApp.BackButton.offClick(handler);
    }
  }, [isHome, router]);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ maxWidth: "430px", margin: "0 auto" }}
    >
      <div className="pb-24">{children}</div>
      <BottomTabBar tabs={adminTabs} subTabs={adminSubTabs} />
    </div>
  );
}
