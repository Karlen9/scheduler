'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ROOM_COLORS, roomColorVar } from '@/lib/room';

import type { ReactNode } from 'react';

type TColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

/***************************************************************************************************
 * Row of the six room palette swatches. The selected swatch shows a check mark.
 ***************************************************************************************************/
export function ColorPicker({ value, onChange }: TColorPickerProps): ReactNode {
  const t = useTranslations('AdminRoom');

  return (
    <div className={'flex flex-wrap gap-3'} role={'group'} aria-label={t('color')}>
      {ROOM_COLORS.map((color) => (
        <button
          key={color}
          type={'button'}
          aria-label={t(`colors.${color}`)}
          aria-pressed={value === color}
          data-testid={`room-color-${color}`}
          onClick={() => onChange(color)}
          style={{ backgroundColor: roomColorVar(color) }}
          className={'flex h-9 w-9 items-center justify-center rounded-full text-white'}
        >
          {value === color && <Check className={'h-4 w-4'} />}
        </button>
      ))}
    </div>
  );
}
