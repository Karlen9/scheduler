"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, User, ClipboardList, CalendarPlus, Repeat } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { initTelegramApp, getTelegramWebApp } from "@/lib/telegram";

const clientTabs = [
  { key: "home", label: "Главная", icon: Home, href: "/" },
  { key: "activity", label: "", icon: Plus, href: "/book", isCenter: true, matchPaths: ["/book", "/bookings", "/recurring"] },
  { key: "profile", label: "Профиль", icon: User, href: "/profile" },
];

const clientSubTabs = [
  { icon: ClipboardList, href: "/bookings" },
  { icon: CalendarPlus, href: "/book" },
  { icon: Repeat, href: "/recurring" },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/" || pathname === "";

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
      style={{ width: "430px", margin: "0 auto" }}
    >
      <div className="pb-24">{children}</div>
      <BottomTabBar tabs={clientTabs} subTabs={clientSubTabs} />
    </div>
  );
}
