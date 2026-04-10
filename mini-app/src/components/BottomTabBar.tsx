'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useEffect, useRef, useState } from 'react';

import type { TBottomTabBarProps } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

function PlusButton({
  href,
  isActive,
  bouncing,
  icon: Icon,
  visualSize,
}: {
  href: string;
  isActive: boolean;
  bouncing: boolean;
  icon: LucideIcon;
  visualSize: number;
}): ReactNode {
  return (
    <Link
      href={href}
      prefetch
      className={'relative z-10 flex h-14 w-full items-center justify-center active:scale-95'}
    >
      <div
        className={`shadow-brand/30 absolute flex items-center justify-center rounded-full shadow-lg transition-all ${
          isActive ? 'bg-brand scale-105 text-white' : 'bg-brand text-white'
        }`}
        style={{
          width: `${visualSize}px`,
          height: `${visualSize}px`,
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%)${isActive ? ' scale(1.05)' : ''}`,
        }}
      >
        <Icon className={`h-8 w-8 ${bouncing ? 'tab-bounce' : ''}`} strokeWidth={2.5} />
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
  activeColor = 'text-brand',
  tabKey,
}: {
  href: string;
  isActive: boolean;
  bouncing: boolean;
  icon: LucideIcon;
  label?: string;
  activeColor?: string;
  tabKey?: string;
}): ReactNode {
  return (
    <Link
      href={href}
      prefetch
      data-tab-key={tabKey}
      className={`z-10 flex h-[46px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors active:scale-90 ${
        isActive ? activeColor : 'text-muted-foreground'
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${bouncing ? 'tab-bounce' : ''}`} />
      {label && (
        <span className={'max-w-full truncate text-[10px] leading-none font-medium'}>{label}</span>
      )}
    </Link>
  );
}

function BottomTabBarComponent({ tabs, subTabs }: TBottomTabBarProps): ReactNode {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);
  const [activeSideStyle, setActiveSideStyle] = useState<{ left: number; width: number } | null>(
    null,
  );
  const [activeSubStyle, setActiveSubStyle] = useState<{ left: number; width: number } | null>(
    null,
  );
  const tabsRef = useRef<HTMLDivElement>(null);
  const subTabsRef = useRef<HTMLDivElement>(null);

  const activeIndex = tabs.findIndex((tab) => {
    if (tab.matchPaths) {
      return tab.matchPaths.some((path) => pathname === path || pathname.startsWith(path + '/'));
    }
    if (tab.href === '/admin' || tab.href === '/') {
      return pathname === tab.href || pathname === tab.href + '/';
    }
    return pathname === tab.href || pathname.startsWith(tab.href + '/');
  });

  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  const isCenterActive = tabs[currentIndex]?.isCenter;
  const showSubTabs = isCenterActive && subTabs && subTabs.length > 0;
  const sideTabs = tabs.filter((tab) => !tab.isCenter);
  const hasCenterButton = tabs.some((tab) => tab.isCenter);
  const activeSideIndex = isCenterActive
    ? -1
    : sideTabs.findIndex((tab) => tab.key === tabs[currentIndex]?.key);
  const activeSubIndex = showSubTabs
    ? subTabs.findIndex((tab) => pathname === tab.href || pathname.startsWith(tab.href + '/'))
    : -1;

  const centerButtonW = sideTabs.length >= 4 ? 58 : 72;
  const centerVisualSize = sideTabs.length >= 4 ? 74 : 82;
  const tabTemplateColumns = tabs
    .map((tab) => (tab.isCenter ? `${centerButtonW}px` : 'minmax(0, 1fr)'))
    .join(' ');

  useEffect(() => {
    function measureActiveSide(): void {
      if (isCenterActive || activeSideIndex < 0 || !tabsRef.current) {
        setActiveSideStyle(null);
        return;
      }

      const activeKey = tabs[currentIndex]?.key;
      if (!activeKey) {
        setActiveSideStyle(null);
        return;
      }

      const activeTab = tabsRef.current.querySelector<HTMLElement>(`[data-tab-key="${activeKey}"]`);
      if (!activeTab) {
        setActiveSideStyle(null);
        return;
      }

      const containerRect = tabsRef.current.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      setActiveSideStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      });
    }

    measureActiveSide();
    window.addEventListener('resize', measureActiveSide);
    return () => window.removeEventListener('resize', measureActiveSide);
  }, [activeSideIndex, currentIndex, isCenterActive, pathname, tabs]);

  useEffect(() => {
    function measureActiveSub(): void {
      if (!showSubTabs || activeSubIndex < 0 || !subTabsRef.current) {
        setActiveSubStyle(null);
        return;
      }

      const activeTab = subTabsRef.current.children[activeSubIndex] as HTMLElement | undefined;
      if (!activeTab) {
        setActiveSubStyle(null);
        return;
      }

      const containerRect = subTabsRef.current.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      setActiveSubStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
      });
    }

    measureActiveSub();
    window.addEventListener('resize', measureActiveSub);
    return () => window.removeEventListener('resize', measureActiveSub);
  }, [activeSubIndex, pathname, showSubTabs]);

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
    <div className={'fixed right-0 bottom-0 left-0 z-50'}>
      <div
        className={'absolute right-0 bottom-0 left-0'}
        style={{
          backgroundColor: 'var(--background)',
          height: 'calc(env(safe-area-inset-bottom) + 88px)',
        }}
      />
      <div className={'relative flex justify-center pb-6'}>
        <div
          className={
            'relative w-[min(calc(100vw-16px),406px)] overflow-visible rounded-full border'
          }
          style={{
            backgroundColor: 'var(--color-tab-bar)',
            borderColor: 'var(--color-tab-bar-border)',
          }}
        >
          {showSubTabs ? (
            <div ref={subTabsRef} className={'relative flex items-center gap-1 px-2 py-1.5'}>
              {activeSubStyle && (
                <div
                  className={'bg-tab-bar-indicator absolute top-1.5 bottom-1.5 rounded-full'}
                  style={{
                    width: `${activeSubStyle.width}px`,
                    left: `${activeSubStyle.left}px`,
                    transition: 'left 300ms ease-in-out',
                  }}
                />
              )}

              {subTabs.map((tab) => {
                const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                const bouncing = animatingKey === tab.href;
                return (
                  <TabButton
                    key={tab.href}
                    href={tab.href}
                    isActive={isActive}
                    bouncing={bouncing}
                    icon={tab.icon}
                    label={tab.label}
                    activeColor={'text-foreground'}
                  />
                );
              })}
            </div>
          ) : (
            <div
              ref={tabsRef}
              className={'relative grid items-center gap-1 px-2 py-1.5'}
              style={{ gridTemplateColumns: tabTemplateColumns }}
            >
              {!isCenterActive && hasCenterButton && activeSideStyle && (
                <div
                  className={'bg-tab-bar-indicator absolute top-1.5 bottom-1.5 rounded-full'}
                  style={{
                    width: `${activeSideStyle.width}px`,
                    left: `${activeSideStyle.left}px`,
                    transition: 'left 300ms ease-in-out',
                  }}
                />
              )}

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
                      visualSize={centerVisualSize}
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
                    tabKey={tab.key}
                  />
                );
              })}
            </div>
          )}
        </div>
        <div
          className={'h-[env(safe-area-inset-bottom)]'}
          style={{ backgroundColor: 'var(--background)' }}
        />
      </div>
    </div>
  );
}

export const BottomTabBar = memo(BottomTabBarComponent);
