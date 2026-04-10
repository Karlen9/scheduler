'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { memo, useEffect, useRef, useState } from 'react';

import type { TBottomTabBarProps } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the plus button UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
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
}): ReactNode {
  return (
    <Link
      href={href}
      prefetch
      className={'relative z-10 mx-5 flex items-center justify-center active:scale-95'}
      style={{ width: '56px' }}
    >
      <div
        className={`shadow-brand/30 absolute flex h-[82px] w-[82px] items-center justify-center rounded-full shadow-lg transition-all ${
          isActive ? 'bg-brand scale-105 text-white' : 'bg-brand text-white'
        }`}
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%)${isActive ? ' scale(1.05)' : ''}`,
        }}
      >
        <Icon className={`h-9 w-9 ${bouncing ? 'tab-bounce' : ''}`} strokeWidth={2.5} />
      </div>
    </Link>
  );
}

/***************************************************************************************************
 * Renders the tab button UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function TabButton({
  href,
  isActive,
  bouncing,
  icon: Icon,
  label,
  activeColor = 'text-brand',
  width = 96,
  tabKey,
}: {
  href: string;
  isActive: boolean;
  bouncing: boolean;
  icon: LucideIcon;
  label?: string;
  activeColor?: string;
  width?: number;
  tabKey?: string;
}): ReactNode {
  return (
    <Link
      href={href}
      prefetch
      data-tab-key={tabKey}
      className={`z-10 flex flex-col items-center justify-center gap-1 rounded-full transition-colors active:scale-90 ${
        isActive ? activeColor : 'text-muted-foreground'
      }`}
      style={{ width: `${width}px`, height: '48px' }}
    >
      <Icon className={`h-5 w-5 ${bouncing ? 'tab-bounce' : ''}`} />
      {label && <span className={'text-[11px] font-medium'}>{label}</span>}
    </Link>
  );
}

/***************************************************************************************************
 * Renders the bottom tab bar UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function BottomTabBarComponent({ tabs, subTabs }: TBottomTabBarProps): ReactNode {
  /***************************************************************************************************
   * Defines the pathname value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the prev path ref value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const prevPathRef = useRef(pathname);
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);

  /***************************************************************************************************
   * Defines the active index value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const activeIndex = tabs.findIndex((tab) => {
    if (tab.matchPaths) {
      return tab.matchPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
    }
    if (tab.href === '/admin' || tab.href === '/') {
      return pathname === tab.href || pathname === tab.href + '/';
    }
    return pathname === tab.href || pathname.startsWith(tab.href + '/');
  });

  /***************************************************************************************************
   * Defines the current index value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  /***************************************************************************************************
   * Defines the is center active value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isCenterActive = tabs[currentIndex]?.isCenter;
  /***************************************************************************************************
   * Defines the show sub tabs value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const showSubTabs = isCenterActive && subTabs && subTabs.length > 0;

  /***************************************************************************************************
   * Defines the side tabs value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const sideTabs = tabs.filter((t) => !t.isCenter);
  /***************************************************************************************************
   * Defines the has center button value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasCenterButton = tabs.some((t) => t.isCenter);
  /***************************************************************************************************
   * Defines the active side index value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const activeSideIndex = isCenterActive
    ? -1
    : sideTabs.findIndex((t) => t.key === tabs[currentIndex]?.key);

  /***************************************************************************************************
   * Defines the active sub index value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const activeSubIndex = showSubTabs
    ? subTabs.findIndex((t) => pathname === t.href || pathname.startsWith(t.href + '/'))
    : -1;

  /***************************************************************************************************
   * Defines the tabs ref value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tabsRef = useRef<HTMLDivElement>(null);
  /***************************************************************************************************
   * Defines the sub tabs ref value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const subTabsRef = useRef<HTMLDivElement>(null);
  const [subTabW, setSubTabW] = useState(0);
  const [activeSideStyle, setActiveSideStyle] = useState<{ left: number; width: number } | null>(
    null,
  );
  const sideTabW = sideTabs.length >= 4 ? 72 : 96;

  useEffect(() => {
    if (subTabsRef.current) {
      /***************************************************************************************************
       * Defines the first value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const first = subTabsRef.current.firstElementChild as HTMLElement | null;
      if (first) {
        setSubTabW(first.offsetWidth);
      }
    }
  }, [subTabsRef]);

  useEffect(() => {
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

    setActiveSideStyle({
      left: activeTab.offsetLeft,
      width: activeTab.offsetWidth,
    });
  }, [activeSideIndex, currentIndex, isCenterActive, pathname, tabs]);

  /***************************************************************************************************
   * Trigger bounce animation on route change.
   ***************************************************************************************************/
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      /***************************************************************************************************
       * Defines the key value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const key = showSubTabs ? pathname : tabs[currentIndex]?.key;
      if (key) {
        setAnimatingKey(key);
        /***************************************************************************************************
         * Defines the timer value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
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
          className={'relative overflow-visible rounded-full border px-3 py-1.5'}
          style={{
            backgroundColor: 'var(--color-tab-bar)',
            borderColor: 'var(--color-tab-bar-border)',
          }}
        >
          {showSubTabs ? (
            <>
              {/***************************************************************************************************
               * Sliding indicator for sub-tabs.
               ***************************************************************************************************/}
              {activeSubIndex >= 0 && subTabW > 0 && (
                <div
                  className={'bg-tab-bar-indicator absolute top-1.5 bottom-1.5 rounded-full'}
                  style={{
                    width: `${subTabW}px`,
                    left: `${6 + activeSubIndex * subTabW}px`,
                    transition: 'left 300ms ease-in-out',
                  }}
                />
              )}

              <div ref={subTabsRef} className={'relative flex items-center'}>
                {subTabs.map((tab) => {
                  /***************************************************************************************************
                   * Defines the is active value used by the component layer.
                   *
                   * Usage context:
                   * - Reused by the component layer to keep shared values centralized.
                   ***************************************************************************************************/
                  const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                  /***************************************************************************************************
                   * Defines the bouncing value used by the component layer.
                   *
                   * Usage context:
                   * - Reused by the component layer to keep shared values centralized.
                   ***************************************************************************************************/
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
            </>
          ) : (
            <>
              {/***************************************************************************************************
               * Active indicator for side tabs.
               ***************************************************************************************************/}
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

              {/***************************************************************************************************
               * Tab buttons.
               ***************************************************************************************************/}
              <div ref={tabsRef} className={'relative flex items-center'}>
                {tabs.map((tab, index) => {
                  /***************************************************************************************************
                   * Defines the is active value used by the component layer.
                   *
                   * Usage context:
                   * - Reused by the component layer to keep shared values centralized.
                   ***************************************************************************************************/
                  const isActive = index === currentIndex;
                  /***************************************************************************************************
                   * Defines the icon value used by the component layer.
                   *
                   * Usage context:
                   * - Reused by the component layer to keep shared values centralized.
                   ***************************************************************************************************/
                  const Icon = tab.icon;
                  /***************************************************************************************************
                   * Defines the bouncing value used by the component layer.
                   *
                   * Usage context:
                   * - Reused by the component layer to keep shared values centralized.
                   ***************************************************************************************************/
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
                      width={sideTabW}
                      tabKey={tab.key}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
        {/***************************************************************************************************
         * Bottom safe area.
         ***************************************************************************************************/}
        <div
          className={'h-[env(safe-area-inset-bottom)]'}
          style={{ backgroundColor: 'var(--background)' }}
        />
      </div>
    </div>
  );
}

export const BottomTabBar = memo(BottomTabBarComponent);
