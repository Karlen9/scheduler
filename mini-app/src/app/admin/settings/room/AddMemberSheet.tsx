'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';

import { ColorPicker } from './ColorPicker';

import type { ReactNode } from 'react';

type TAddMemberSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Colour preselected when the sheet opens (first colour nobody uses yet). */
  defaultColor: string;
  saving: boolean;
  onSubmit: (params: { name: string; color: string; invite: boolean }) => void;
};

/***************************************************************************************************
 * "Add a colleague" sheet: name, colour and the two ways to bring the colleague in - mark their
 * days yourself (offline member) or invite them by link.
 ***************************************************************************************************/
export function AddMemberSheet({
  isOpen,
  onClose,
  defaultColor,
  saving,
  onSubmit,
}: TAddMemberSheetProps): ReactNode {
  const t = useTranslations('AdminRoom');
  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultColor);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setColor(defaultColor);
    }
  }, [isOpen, defaultColor]);

  const trimmed = name.trim();
  const submit = (invite: boolean): void => {
    if (trimmed) {
      onSubmit({ name: trimmed, color, invite });
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('addMemberTitle')}>
      <div className={'space-y-4'}>
        <div>
          <label className={'text-muted-foreground mb-1 block text-sm'}>{t('memberName')}</label>
          <input
            type={'text'}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('memberNamePlaceholder')}
            className={
              'bg-background text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
            }
          />
        </div>

        <div className={'space-y-2'}>
          <p className={'text-muted-foreground text-sm'}>{t('color')}</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div className={'space-y-2'}>
          <PrimaryButton onClick={() => submit(false)} disabled={saving || !trimmed}>
            {t('markMyself')}
          </PrimaryButton>
          <button
            type={'button'}
            onClick={() => submit(true)}
            disabled={saving || !trimmed}
            className={
              'bg-background text-foreground w-full rounded-xl px-4 py-3.5 text-base font-medium active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40'
            }
          >
            {t('inviteByLink')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
