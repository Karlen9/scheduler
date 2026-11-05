import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

// Sized in container units of the phone screen; clears the dynamic island in the middle.
export function StatusBar(): ReactNode {
  const t = useTranslations('mocks');

  return (
    <div
      aria-hidden={'true'}
      className={
        'text-foreground pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[10.4cqw] items-center justify-between px-[8.6cqw] pt-[0.8cqw]'
      }
    >
      <span className={'text-[4.3cqw] leading-none font-semibold tracking-tight'}>
        {t('statusTime')}
      </span>
      <span className={'flex items-center gap-[1.5cqw]'}>
        <svg viewBox={'0 0 18 12'} className={'h-[3.2cqw]'} fill={'currentColor'}>
          <rect x={'0'} y={'8'} width={'3'} height={'4'} rx={'0.8'} />
          <rect x={'5'} y={'5.5'} width={'3'} height={'6.5'} rx={'0.8'} />
          <rect x={'10'} y={'3'} width={'3'} height={'9'} rx={'0.8'} />
          <rect x={'15'} y={'0'} width={'3'} height={'12'} rx={'0.8'} />
        </svg>
        <svg
          viewBox={'0 0 17 12'}
          className={'h-[3.2cqw]'}
          fill={'none'}
          stroke={'currentColor'}
          strokeWidth={'1.8'}
          strokeLinecap={'round'}
        >
          <path d={'M1.2 4.2a10 10 0 0 1 14.6 0'} />
          <path d={'M3.8 7a6.3 6.3 0 0 1 9.4 0'} />
          <circle cx={'8.5'} cy={'10.3'} r={'0.9'} fill={'currentColor'} stroke={'none'} />
        </svg>
        <svg viewBox={'0 0 28 13'} className={'h-[3.4cqw]'} fill={'none'}>
          <rect
            x={'0.7'}
            y={'0.7'}
            width={'23'}
            height={'11.6'}
            rx={'3.4'}
            stroke={'currentColor'}
            strokeOpacity={'0.45'}
            strokeWidth={'1.2'}
          />
          <rect x={'2.3'} y={'2.3'} width={'20'} height={'8.4'} rx={'2'} fill={'currentColor'} />
          <path
            d={'M25.6 4.6v3.8c.9-.3 1.6-1.1 1.6-1.9s-.7-1.6-1.6-1.9Z'}
            fill={'currentColor'}
            opacity={'0.5'}
          />
        </svg>
      </span>
    </div>
  );
}

export function HomeIndicator(): ReactNode {
  return (
    <span
      aria-hidden={'true'}
      className={
        'bg-foreground pointer-events-none absolute bottom-[2.2cqw] left-1/2 z-10 h-[1.4cqw] w-[34cqw] -translate-x-1/2 rounded-full'
      }
    />
  );
}
