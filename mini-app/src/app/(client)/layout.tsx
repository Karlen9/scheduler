"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, User, ClipboardList } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { initTelegramApp, getTelegramWebApp } from "@/lib/telegram";

const clientTabs = [
  { key: "bookings", label: "Записи", icon: ClipboardList, href: "/bookings", matchPaths: ["/bookings", "/recurring"] },
  { key: "book", label: "", icon: Plus, href: "/book", isCenter: true },
  { key: "profile", label: "Профиль", icon: User, href: "/profile" },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/" || pathname === "";
  const isBookPage = pathname === "/book";

  useEffect(() => {
    initTelegramApp();
  }, []);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) return;

    if (isHome) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
      const handler = () => router.push("/");
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
      {!isBookPage && <BottomTabBar tabs={clientTabs} />}
    </div>
  );
}
