"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";
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
  label?: string;
}

function PlusButton({
  href,
  isActive,
  bouncing,
  icon: Icon,
}: {
  href: string;
  isActive: boolean;
  bouncing: boolean;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="relative z-10 flex items-center justify-center mx-5 active:scale-95"
      style={{ width: "56px" }}
    >
      <div
        className={`absolute w-[82px] h-[82px] rounded-full flex items-center justify-center transition-all shadow-lg shadow-brand/30 ${
          isActive
            ? "bg-brand text-white scale-105"
            : "bg-brand text-white"
        }`}
        style={{ top: "50%", transform: `translateY(-50%)${isActive ? " scale(1.05)" : ""}` }}
      >
        <Icon className={`w-9 h-9 ${bouncing ? "tab-bounce" : ""}`} strokeWidth={2.5} />
      </div>
    </Link>
  );
}

function TabButton({
  href,
  isActive,
  bouncing,
  icon: Icon,
  label,
  activeColor = "text-brand",
}: {
  href: string;
  isActive: boolean;
  bouncing: boolean;
  icon: LucideIcon;
  label?: string;
  activeColor?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 rounded-full transition-colors z-10 active:scale-90 ${
        isActive ? activeColor : "text-muted-foreground"
      }`}
      style={{ width: "80px", height: "48px" }}
    >
      <Icon className={`w-5 h-5 ${bouncing ? "tab-bounce" : ""}`} />
      {label && <span className="text-[11px] font-medium">{label}</span>}
    </Link>
  );
}

interface BottomTabBarProps {
  tabs: Tab[];
  subTabs?: SubTab[];
}

export function BottomTabBar({ tabs, subTabs }: BottomTabBarProps) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);

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

  const tabsRef = useRef<HTMLDivElement>(null);
  const subTabsRef = useRef<HTMLDivElement>(null);
  const [sideTabW, setSideTabW] = useState(0);
  const [subTabW, setSubTabW] = useState(0);

  useEffect(() => {
    if (tabsRef.current) {
      const first = tabsRef.current.firstElementChild as HTMLElement | null;
      if (first) setSideTabW(first.offsetWidth);
    }
    if (subTabsRef.current) {
      const first = subTabsRef.current.firstElementChild as HTMLElement | null;
      if (first) setSubTabW(first.offsetWidth);
    }
  });

  // Trigger bounce animation on route change
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      const key = showSubTabs ? pathname : tabs[currentIndex]?.key;
      if (key) {
        setAnimatingKey(key);
        const timer = setTimeout(() => setAnimatingKey(null), 300);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname, currentIndex, showSubTabs, tabs]);

  return (
      <div className="fixed bottom-0 left-0 right-0 pb-6 flex justify-center">
        <div className="relative bg-[#1c1c1e] rounded-full border border-[#3a3a3a] px-1.5 py-1.5 overflow-visible">
          {showSubTabs ? (
            <>
              {/* Sliding indicator for sub-tabs */}
              {activeSubIndex >= 0 && subTabW > 0 && (
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-full bg-[#2c2c2e]"
                  style={{
                    width: `${subTabW}px`,
                    left: `${6 + activeSubIndex * subTabW}px`,
                    transition: "left 300ms ease-in-out",
                  }}
                />
              )}

              <div ref={subTabsRef} className="relative flex items-center">
                {subTabs.map((tab) => {
                  const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
                  const bouncing = animatingKey === tab.href;
                  return (
                    <TabButton
                      key={tab.href}
                      href={tab.href}
                      isActive={isActive}
                      bouncing={bouncing}
                      icon={tab.icon}
                      label={tab.label}
                      activeColor="text-foreground"
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Active indicator for side tabs */}
              {!isCenterActive && hasCenterButton && activeSideIndex >= 0 && sideTabW > 0 && (
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-full bg-[#2c2c2e]"
                  style={{
                    width: `${sideTabW}px`,
                    left: activeSideIndex === 0
                      ? "6px"
                      : `calc(100% - 6px - ${sideTabW}px)`,
                    transition: "left 300ms ease-in-out",
                  }}
                />
              )}

              {/* Tab buttons */}
              <div ref={tabsRef} className="relative flex items-center">
                {tabs.map((tab, index) => {
                  const isActive = index === currentIndex;
                  const Icon = tab.icon;
                  const bouncing = animatingKey === tab.key;

                  if (tab.isCenter) {
                    return (
                      <PlusButton
                        key={tab.key}
                        href={tab.href}
                        isActive={isActive}
                        bouncing={bouncing}
                        icon={Icon}
                      />
                    );
                  }

                  return (
                    <TabButton
                      key={tab.key}
                      href={tab.href}
                      isActive={isActive}
                      bouncing={bouncing}
                      icon={Icon}
                      label={tab.label}
                    />
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
