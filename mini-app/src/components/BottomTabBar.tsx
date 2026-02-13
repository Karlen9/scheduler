"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface Tab {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  isCenter?: boolean;
  matchPaths?: string[];
}

interface SubTab {
  icon: LucideIcon;
  href: string;
}

interface BottomTabBarProps {
  tabs: Tab[];
  subTabs?: SubTab[];
}

export function BottomTabBar({ tabs, subTabs }: BottomTabBarProps) {
  const pathname = usePathname();

  const activeIndex = tabs.findIndex((tab) => {
    if (tab.matchPaths) {
      return tab.matchPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
    }
    if (tab.href === "/admin" || tab.href === "/") {
      return pathname === tab.href || pathname === tab.href + "/";
    }
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  });

  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  const isCenterActive = tabs[currentIndex]?.isCenter;
  const showSubTabs = isCenterActive && subTabs && subTabs.length > 0;

  const sideTabs = tabs.filter((t) => !t.isCenter);
  const hasCenterButton = tabs.some((t) => t.isCenter);
  const activeSideIndex = isCenterActive
    ? -1
    : sideTabs.findIndex((t) => t.key === tabs[currentIndex]?.key);

  const activeSubIndex = showSubTabs
    ? subTabs.findIndex((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    : -1;

  return (
    <div className="fixed bottom-0 left-0 right-0 px-4 pb-4" style={{ width: "430px", margin: "0 auto" }}>
      <div className="relative bg-[#1c1c1e] rounded-full border border-[#3a3a3a] px-2 py-2">
        {showSubTabs ? (
          <>
            {/* Sliding indicator for sub-tabs */}
            {activeSubIndex >= 0 && (
              <div
                className="absolute top-2 bottom-2 rounded-full bg-[#2c2c2e] transition-transform duration-300 ease-in-out"
                style={{
                  width: `calc((100% - 16px) / ${subTabs.length})`,
                  transform: `translateX(calc(${activeSubIndex} * 100%))`,
                  left: "8px",
                }}
              />
            )}

            <div className="relative flex items-center">
              {subTabs.map((tab) => {
                const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`flex-1 flex items-center justify-center py-3.5 rounded-full transition-colors z-10 ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Sliding active indicator — only for side tabs */}
            {!isCenterActive && hasCenterButton && activeSideIndex >= 0 && (() => {
              const tabWidth = `(100% - 16px - 64px) / ${sideTabs.length}`;
              const inset = 32;
              const left = activeSideIndex === 0
                ? `${8 + inset}px`
                : `calc(8px + (${tabWidth}) + 64px + ${inset}px)`;
              return (
                <div
                  className="absolute top-2 bottom-2 rounded-full bg-[#2c2c2e]"
                  style={{
                    width: `calc(${tabWidth} - ${inset * 2}px)`,
                    left,
                    transition: "left 300ms ease-in-out",
                  }}
                />
              );
            })()}
            {!hasCenterButton && (
              <div
                className="absolute top-2 bottom-2 rounded-full bg-[#2c2c2e] transition-transform duration-300 ease-in-out"
                style={{
                  width: `calc((100% - 16px) / ${tabs.length})`,
                  transform: `translateX(calc(${currentIndex} * 100%))`,
                  left: "8px",
                }}
              />
            )}

            {/* Tab buttons */}
            <div className="relative flex items-center">
              {tabs.map((tab, index) => {
                const isActive = index === currentIndex;
                const Icon = tab.icon;

                if (tab.isCenter) {
                  return (
                    <Link
                      key={tab.key}
                      href={tab.href}
                      className="relative z-10 flex items-center justify-center mx-1"
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                          isActive
                            ? "bg-brand text-white scale-105"
                            : "bg-brand/80 text-white"
                        }`}
                      >
                        <Icon className="w-7 h-7" strokeWidth={2.5} />
                      </div>
                    </Link>
                  );
                }

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
          </>
        )}
      </div>
      {/* Bottom safe area */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
