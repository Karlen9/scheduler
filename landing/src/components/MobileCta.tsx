'use client';

import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

type TMobileCtaProps = {
  label: string;
  href: string;
};

export function MobileCta({ label, href }: TMobileCtaProps): ReactNode {
  const [heroGone, setHeroGone] = useState(false);
  const [closingVisible, setClosingVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('top');
    const closing = document.getElementById('closing');
    if (!hero || !closing || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const heroObserver = new IntersectionObserver(([entry]) => {
      setHeroGone(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
    });
    const closingObserver = new IntersectionObserver(([entry]) => {
      setClosingVisible(entry.isIntersecting);
    });
    heroObserver.observe(hero);
    closingObserver.observe(closing);
    return () => {
      heroObserver.disconnect();
      closingObserver.disconnect();
    };
  }, []);

  const visible = heroGone && !closingVisible;

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[transform,opacity,visibility] duration-300 md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'invisible translate-y-4 opacity-0'
      }`}
      style={{
        background:
          'linear-gradient(to top, var(--background) 55%, color-mix(in srgb, var(--background) 0%, transparent))',
      }}
    >
      <a
        href={href}
        target={'_blank'}
        rel={'noopener noreferrer'}
        tabIndex={visible ? 0 : -1}
        className={
          'bg-primary text-primary-foreground pointer-events-auto flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full text-base font-semibold shadow-[0_10px_28px_-12px_var(--primary)]'
        }
      >
        <Send aria-hidden={'true'} className={'size-[1.05em]'} />
        {label}
      </a>
    </div>
  );
}
