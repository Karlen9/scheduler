'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';

import { ColorPicker } from './ColorPicker';

import type { TRoomMember } from '@/lib/types';
import type { ReactNode } from 'react';

type TMemberSheetProps = {
  member: TRoomMember | null;
  isCreator: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (id: string, changes: { name?: string; color?: string }) => void;
  onInvite: (member: TRoomMember) => void;
  /** Asks for confirmation before deleting an offline member / removing a linked one. */
  onRemove: (member: TRoomMember) => void;
};

/***************************************************************************************************
 * Sheet for one room member.
 * - offline member: rename, colour, "invite to the app", delete;
 * - the caller: colour only;
 * - another linked member: "remove from the room" for the room creator only.
 ***************************************************************************************************/
export function MemberSheet({
  member,
  isCreator,
  saving,
  onClose,
  onSave,
  onInvite,
  onRemove,
}: TMemberSheetProps): ReactNode {
  const t = useTranslations('AdminRoom');
  const [name, setName] = useState('');
  const [color, setColor] = useState('green');
  // Keep rendering the last member while the sheet animates out.
  const retainedRef = useRef<TRoomMember | null>(member);
  if (member) {
    retainedRef.current = member;
  }
  const shown = member ?? retainedRef.current;

  useEffect(() => {
    if (member) {
      setName(member.name);
      setColor(member.color);
    }
  }, [member]);

  if (!shown) {
    return null;
  }

  const offline = !shown.linked;
  const canEditColor = offline || Boolean(shown.isMe);
  const trimmed = name.trim();
  const changed = (offline && trimmed !== shown.name) || (canEditColor && color !== shown.color);

  const save = (): void => {
    const changes: { name?: string; color?: string } = {};
    if (offline && trimmed !== shown.name) {
      changes.name = trimmed;
    }
    if (canEditColor && color !== shown.color) {
      changes.color = color;
    }
    onSave(shown.id, changes);
  };

  return (
    <BottomSheet
      isOpen={member !== null}
      onClose={onClose}
      title={shown.isMe ? t('you') : shown.name}
    >
      <div className={'space-y-4'}>
        {offline && (
          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('memberName')}</label>
            <input
              type={'text'}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className={
                'bg-background text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>
        )}

        {canEditColor && (
          <div className={'space-y-2'}>
            <p className={'text-muted-foreground text-sm'}>{t('color')}</p>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        )}

        {canEditColor && (
          <PrimaryButton onClick={save} disabled={saving || !changed || (offline && !trimmed)}>
            {t('save')}
          </PrimaryButton>
        )}

        {offline && (
          <button
            type={'button'}
            onClick={() => onInvite(shown)}
            className={
              'bg-background text-foreground w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
            }
          >
            {t('inviteToApp')}
          </button>
        )}

        {offline && (
          <button
            type={'button'}
            onClick={() => onRemove(shown)}
            className={
              'text-destructive bg-destructive/10 w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
            }
          >
            {t('deleteMember')}
          </button>
        )}

        {shown.linked && !shown.isMe && isCreator && (
          <button
            type={'button'}
            onClick={() => onRemove(shown)}
            className={
              'text-destructive bg-destructive/10 w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
            }
          >
            {t('excludeMember')}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
