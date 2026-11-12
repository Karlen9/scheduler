'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { copyText } from '@/lib/clipboard';
import { shareTelegramLink } from '@/lib/telegram';

import type { ReactNode } from 'react';

type TInviteSheetProps = {
  /** Invite link to share; the sheet is open while it is set. */
  link: string | null;
  memberName: string;
  onClose: () => void;
};

/***************************************************************************************************
 * Shows a freshly created invite link with the two ways to hand it over: the Telegram share
 * sheet and a copy-to-clipboard fallback.
 ***************************************************************************************************/
export function InviteSheet({ link, memberName, onClose }: TInviteSheetProps): ReactNode {
  const t = useTranslations('AdminRoom');

  const handleCopy = async (): Promise<void> => {
    if (!link) {
      return;
    }
    if (await copyText(link)) {
      toast.success(t('linkCopied'));
    } else {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <BottomSheet
      isOpen={link !== null}
      onClose={onClose}
      title={t('inviteTitle', { name: memberName })}
    >
      <div className={'space-y-3'}>
        <p className={'text-muted-foreground text-sm'}>{t('inviteHint')}</p>
        <p
          data-testid={'room-invite-link'}
          className={'bg-background text-foreground rounded-lg px-3 py-3 text-xs break-all'}
        >
          {link}
        </p>
        <PrimaryButton
          onClick={() => {
            if (link) {
              shareTelegramLink(link, t('inviteShareText'));
            }
          }}
        >
          {t('shareTelegram')}
        </PrimaryButton>
        <button
          type={'button'}
          onClick={() => {
            void handleCopy();
          }}
          className={
            'bg-background text-foreground w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
          }
        >
          {t('copyLink')}
        </button>
      </div>
    </BottomSheet>
  );
}
