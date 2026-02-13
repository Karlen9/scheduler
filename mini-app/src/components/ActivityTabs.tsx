"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Записи", href: "/bookings" },
  { label: "Запись", href: "/book" },
  { label: "Расписание", href: "/recurring" },
];

export function ActivityTabs() {
  const pathname = usePathname();

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex bg-[#1c1c1e] rounded-full p-1">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center py-2 text-sm font-medium rounded-full transition-colors ${
                isActive
                  ? "bg-[#2c2c2e] text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
