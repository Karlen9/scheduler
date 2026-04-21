'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { isBotDeleted, subscribeBotDeleted } from '@/lib/bot-deleted';
import { getTelegramWebApp } from '@/lib/telegram';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Full-screen terminal overlay rendered once the backend returns 410 Gone (specialist soft-deleted
 * their bot). Blocks the entire UI — old Telegram "Open" buttons and cached Mini App sessions will
 * keep launching the app, so this is the gate that makes the bot unusable from the user's side.
 ***************************************************************************************************/
export function BotDeletedOverlay(): ReactNode {
  const [visible, setVisible] = useState(false);
  const t = useTranslations('DeleteBot');

  useEffect(() => {
    if (isBotDeleted()) {
      setVisible(true);
    }
    return subscribeBotDeleted(() => setVisible(true));
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={
        'bg-background fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center'
      }
    >
      <div className={'text-foreground text-xl font-semibold'}>{t('goneTitle')}</div>
      <div className={'text-muted-foreground mt-2 max-w-sm text-sm'}>{t('goneBody')}</div>
      <button
        type={'button'}
        onClick={() => getTelegramWebApp()?.close?.()}
        className={
          'bg-brand mt-6 rounded-xl px-6 py-3 text-[15px] font-medium text-white active:opacity-80'
        }
      >
        {t('goneClose')}
      </button>
    </div>
  );
}
