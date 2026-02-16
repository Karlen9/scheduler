"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Plus, User } from "lucide-react";
import { BottomTabBar } from "./BottomTabBar";
import { getTelegramWebApp } from "@/lib/telegram";

interface AdminLayoutProps {
  children: ReactNode;
}

const adminTabs = [
  { key: "home", label: "Записи", icon: ClipboardList, href: "/admin", matchPaths: ["/admin/recurring"] },
  { key: "book", label: "", icon: Plus, href: "/admin/book", isCenter: true },
  { key: "profile", label: "Профиль", icon: User, href: "/admin/settings" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/admin" || pathname === "/admin/";
  const isBookPage = pathname === "/admin/book";

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
      <div className={isBookPage ? "" : "pb-24"}>{children}</div>
      {!isBookPage && <BottomTabBar tabs={adminTabs} />}
    </div>
  );
}
