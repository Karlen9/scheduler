'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

export type TWallpaperId = 'none' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6' | 'fitness';

export const WALLPAPER_IDS: TWallpaperId[] = [
  'none',
  'w1',
  'w2',
  'w3',
  'w4',
  'w5',
  'w6',
  'fitness',
];

function PatternW1(): ReactNode {
  return (
    <svg width={'100%'} height={'100%'} xmlns={'http://www.w3.org/2000/svg'}>
      <defs>
        <pattern id={'p-w1'} width={20} height={20} patternUnits={'userSpaceOnUse'}>
          <circle cx={10} cy={10} r={2} fill={'currentColor'} opacity={0.5} />
        </pattern>
      </defs>
      <rect width={'100%'} height={'100%'} fill={'url(#p-w1)'} />
    </svg>
  );
}

function PatternW2(): ReactNode {
  return (
    <svg width={'100%'} height={'100%'} xmlns={'http://www.w3.org/2000/svg'}>
      <defs>
        <pattern id={'p-w2'} width={24} height={24} patternUnits={'userSpaceOnUse'}>
          <line
            x1={0}
            y1={24}
            x2={24}
            y2={0}
            stroke={'currentColor'}
            strokeWidth={1}
            opacity={0.3}
          />
        </pattern>
      </defs>
      <rect width={'100%'} height={'100%'} fill={'url(#p-w2)'} />
    </svg>
  );
}

function PatternW3(): ReactNode {
  return (
    <svg width={'100%'} height={'100%'} xmlns={'http://www.w3.org/2000/svg'}>
      <defs>
        <pattern id={'p-w3'} width={30} height={30} patternUnits={'userSpaceOnUse'}>
          <circle
            cx={15}
            cy={15}
            r={8}
            fill={'none'}
            stroke={'currentColor'}
            strokeWidth={1}
            opacity={0.3}
          />
        </pattern>
      </defs>
      <rect width={'100%'} height={'100%'} fill={'url(#p-w3)'} />
    </svg>
  );
}

function PatternW4(): ReactNode {
  return (
    <svg width={'100%'} height={'100%'} xmlns={'http://www.w3.org/2000/svg'}>
      <defs>
        <pattern id={'p-w4'} width={16} height={16} patternUnits={'userSpaceOnUse'}>
          <rect x={0} y={0} width={8} height={8} fill={'currentColor'} opacity={0.1} />
          <rect x={8} y={8} width={8} height={8} fill={'currentColor'} opacity={0.1} />
        </pattern>
      </defs>
      <rect width={'100%'} height={'100%'} fill={'url(#p-w4)'} />
    </svg>
  );
}

function PatternW5(): ReactNode {
  return (
    <svg width={'100%'} height={'100%'} xmlns={'http://www.w3.org/2000/svg'}>
      <defs>
        <pattern id={'p-w5'} width={20} height={20} patternUnits={'userSpaceOnUse'}>
          <path
            d={'M0 10 L10 0 L20 10 L10 20 Z'}
            fill={'none'}
            stroke={'currentColor'}
            strokeWidth={1}
            opacity={0.25}
          />
        </pattern>
      </defs>
      <rect width={'100%'} height={'100%'} fill={'url(#p-w5)'} />
    </svg>
  );
}

function PatternW6(): ReactNode {
  return (
    <svg width={'100%'} height={'100%'} xmlns={'http://www.w3.org/2000/svg'}>
      <defs>
        <pattern id={'p-w6'} width={12} height={12} patternUnits={'userSpaceOnUse'}>
          <line
            x1={0}
            y1={6}
            x2={12}
            y2={6}
            stroke={'currentColor'}
            strokeWidth={1}
            opacity={0.2}
          />
          <line
            x1={6}
            y1={0}
            x2={6}
            y2={12}
            stroke={'currentColor'}
            strokeWidth={1}
            opacity={0.2}
          />
        </pattern>
      </defs>
      <rect width={'100%'} height={'100%'} fill={'url(#p-w6)'} />
    </svg>
  );
}

function PatternFitness(): ReactNode {
  return (
    <div
      className={'h-full w-full bg-cover bg-center bg-no-repeat dark:invert'}
      style={{ backgroundImage: "url('/fintess-transparent.svg')" }}
    />
  );
}

const WALLPAPER_COMPONENTS: Record<string, () => ReactNode> = {
  w1: PatternW1,
  w2: PatternW2,
  w3: PatternW3,
  w4: PatternW4,
  w5: PatternW5,
  w6: PatternW6,
  fitness: PatternFitness,
};

type TWallpaperPickerProps = {
  value: TWallpaperId;
  onChange: (id: TWallpaperId) => void;
};

export function WallpaperPicker({ value, onChange }: TWallpaperPickerProps): ReactNode {
  const t = useTranslations('AdminProfile');

  return (
    <div>
      <label className={'text-muted-foreground mb-2 block text-sm'}>{t('wallpaperLabel')}</label>
      <div className={'grid grid-cols-3 gap-2'}>
        {WALLPAPER_IDS.map((id) => {
          const isSelected = value === id;
          const Pattern = id !== 'none' ? WALLPAPER_COMPONENTS[id] : null;

          return (
            <button
              key={id}
              type={'button'}
              onClick={() => onChange(id)}
              className={`relative h-[72px] overflow-hidden rounded-lg border-2 transition-all ${
                isSelected ? 'border-brand ring-brand/30 ring-2' : 'border-surface-border'
              } ${id === 'none' ? 'bg-card' : id === 'fitness' ? 'bg-card' : 'bg-brand/10 text-brand'}`}
            >
              {Pattern && (
                <div className={'absolute inset-0'}>
                  <Pattern />
                </div>
              )}
              {id === 'none' && <span className={'text-muted-foreground text-xs'}>{'—'}</span>}
              {isSelected && (
                <div
                  className={
                    'bg-brand absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full'
                  }
                >
                  <Check className={'h-3 w-3 text-white'} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TWallpaperBackgroundProps = {
  wallpaper?: string;
};

export function WallpaperBackground({ wallpaper }: TWallpaperBackgroundProps): ReactNode {
  if (!wallpaper || wallpaper === 'none') {
    return null;
  }

  const Pattern = WALLPAPER_COMPONENTS[wallpaper];
  if (!Pattern) {
    return null;
  }

  return (
    <div className={'text-brand pointer-events-none absolute inset-0'}>
      <Pattern />
    </div>
  );
}
