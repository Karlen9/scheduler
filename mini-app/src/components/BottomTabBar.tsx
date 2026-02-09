"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

interface BottomTabBarProps {
  tabs: Tab[];
}

export function BottomTabBar({ tabs }: BottomTabBarProps) {
  const pathname = usePathname();

  const activeIndex = tabs.findIndex((tab) => {
    if (tab.href === "/admin" || tab.href === "/") {
      return pathname === tab.href || pathname === tab.href + "/";
    }
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  });

  const currentIndex = activeIndex === -1 ? 0 : activeIndex;

  return (
    <div className="fixed bottom-4 left-4 right-4" style={{ maxWidth: "398px", margin: "0 auto" }}>
      <div className="relative bg-[#1c1c1e] rounded-full border border-[#3a3a3a] px-2 py-2">
        {/* Sliding active indicator */}
        <div
          className="absolute top-2 bottom-2 rounded-full bg-[#2c2c2e] transition-transform duration-300 ease-in-out"
          style={{
            width: `calc((100% - 16px) / ${tabs.length})`,
            transform: `translateX(calc(${currentIndex} * 100%))`,
            left: "8px",
          }}
        />

        {/* Tab buttons */}
        <div className="relative flex">
          {tabs.map((tab, index) => {
            const isActive = index === currentIndex;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-full transition-colors z-10 ${
                  isActive ? "text-brand" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Bottom safe area */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
