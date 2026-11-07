'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Fixed bottom action panel plus an in-flow spacer that always matches the panel's real height.
 *
 * The panel is `position: fixed`, so the page needs bottom room equal to its height to scroll the
 * last field clear of it. A hard-coded padding either leaves a big empty gap or hides content when
 * the panel grows (date chips, consent text), so the height is measured with a ResizeObserver.
 *
 * The spacer pulls up by 16px (the preceding `space-y-4` gap) so the last field ends right above
 * the panel; the panel's own 16px padding then provides the visible gap to the button.
 *
 * Usage context:
 * - Render as the LAST child of the scrolling content column.
 ***************************************************************************************************/
export function PinnedPanel({ children }: { children: ReactNode }): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const update = (): void => setHeight(panel.offsetHeight);
    update();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={panelRef}
        className={'bg-background/80 fixed right-0 bottom-0 left-0 space-y-3 p-4 backdrop-blur-sm'}
        style={{ maxWidth: '430px', margin: '0 auto' }}
      >
        {children}
      </div>
      <div aria-hidden={'true'} style={{ height, marginTop: -16 }} />
    </>
  );
}
