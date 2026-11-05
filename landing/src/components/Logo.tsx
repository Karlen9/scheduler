import { useLocale } from 'next-intl';

import { LOGO } from '@/lib/logo';
import { getProductName } from '@/lib/site';

import type { ReactNode } from 'react';

export function LogoMark({ className = 'size-9' }: { className?: string }): ReactNode {
  return (
    <svg
      viewBox={LOGO.viewBox}
      fill={'none'}
      stroke={'currentColor'}
      aria-hidden={'true'}
      className={`text-primary shrink-0 ${className}`}
    >
      <circle
        cx={LOGO.ring.cx}
        cy={LOGO.ring.cy}
        r={LOGO.ring.r}
        strokeWidth={LOGO.ring.strokeWidth}
      />
      <polyline
        points={LOGO.check.points}
        strokeWidth={LOGO.check.strokeWidth}
        strokeLinecap={'round'}
        strokeLinejoin={'round'}
      />
    </svg>
  );
}

export function Logo({ href, label }: { href: string; label: string }): ReactNode {
  return (
    <a href={href} aria-label={label} className={'flex items-center gap-2.5 rounded-full py-1.5'}>
      <LogoMark className={'size-9'} />
      <span className={'text-[1.0625rem] font-bold tracking-tight whitespace-nowrap'}>
        {getProductName(useLocale())}
      </span>
    </a>
  );
}
