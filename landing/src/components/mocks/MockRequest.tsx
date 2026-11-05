import { Check, ChevronLeft, Ellipsis, Mic, Paperclip } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PRODUCT_NAME } from '@/lib/site';

import { LogoMark } from '../Logo';

import type { ReactNode } from 'react';

const BUBBLE = 'bg-card rounded-[4cqw] rounded-bl-[1cqw] px-[3.8cqw] py-[3cqw]';

export function MockRequest(): ReactNode {
  const t = useTranslations('mocks.request');

  return (
    <div className={'flex h-full flex-col'}>
      <div className={'bg-card flex items-center gap-[2.6cqw] px-[3.4cqw] pt-[12cqw] pb-[3cqw]'}>
        <ChevronLeft aria-hidden={'true'} className={'text-primary size-[6.4cqw]'} />
        <span
          className={'bg-background flex size-[10.4cqw] items-center justify-center rounded-full'}
        >
          <LogoMark className={'size-[7.4cqw]'} />
        </span>
        <div className={'leading-tight'}>
          <div className={'text-[4.8cqw] font-bold'}>{t('bot', { name: PRODUCT_NAME })}</div>
          <div className={'text-soft text-[3.8cqw]'}>{t('status')}</div>
        </div>
        <Ellipsis aria-hidden={'true'} className={'text-primary ml-auto size-[6cqw]'} />
      </div>

      <div
        className={'flex flex-1 flex-col justify-end gap-[2.8cqw] px-[4cqw] pt-[4cqw] pb-[3.4cqw]'}
      >
        <div className={`${BUBBLE} w-[78%]`}>
          <div className={'text-[4.6cqw] font-bold'}>{t('digestTitle')}</div>
          <div className={'mt-[1cqw] text-[4.6cqw] leading-snug'}>{t('digestText')}</div>
          <div className={'text-soft mt-[1.2cqw] text-right text-[3.4cqw]'}>{t('digestTime')}</div>
        </div>

        <div className={`${BUBBLE} w-[82%]`}>
          <div className={'text-[4.6cqw] font-bold'}>{t('reminderTitle')}</div>
          <div className={'mt-[1cqw] text-[4.6cqw] leading-snug'}>{t('reminderText')}</div>
          <div className={'text-soft mt-[1.2cqw] text-right text-[3.4cqw]'}>
            {t('reminderTime')}
          </div>
        </div>

        <div className={`${BUBBLE} w-[86%]`}>
          <div className={'text-[4.6cqw] font-bold'}>{t('prevTitle')}</div>
          <div className={'mt-[1cqw] text-[4.6cqw] leading-snug'}>{t('prevClient')}</div>
          <div className={'text-soft text-[4.2cqw] leading-snug'}>{t('prevWhen')}</div>
          <div className={'mt-[1.6cqw] flex items-center justify-between'}>
            <span
              className={
                'bg-status-confirmed-bg text-status-confirmed-text inline-flex items-center gap-[1cqw] rounded-full px-[2.4cqw] py-[0.8cqw] text-[3.6cqw] font-semibold'
              }
            >
              <Check aria-hidden={'true'} className={'size-[3.6cqw]'} strokeWidth={3} />
              {t('prevStatus')}
            </span>
            <span className={'text-soft text-[3.4cqw]'}>{t('prevTime')}</span>
          </div>
        </div>

        <div
          className={
            'bg-foreground/10 text-soft mx-auto rounded-full px-[3.4cqw] py-[1cqw] text-[3.8cqw] font-medium'
          }
        >
          {t('today')}
        </div>

        <div className={`${BUBBLE} w-[88%]`}>
          <div className={'text-[4.8cqw] font-bold'}>{t('title')}</div>
          <div className={'mt-[1.4cqw] text-[4.8cqw] leading-snug'}>{t('client')}</div>
          <div className={'text-soft text-[4.4cqw] leading-snug'}>{t('when')}</div>
          <div className={'text-soft mt-[1.2cqw] text-right text-[3.4cqw]'}>{t('time')}</div>
        </div>
        <div className={'grid w-[88%] grid-cols-2 gap-[2cqw]'}>
          <div
            className={
              'bg-action-confirm-bg text-action-confirm-text rounded-[3cqw] py-[3.2cqw] text-center text-[4.4cqw] font-bold'
            }
          >
            {t('accept')}
          </div>
          <div
            className={
              'bg-action-danger-bg text-action-danger-text rounded-[3cqw] py-[3.2cqw] text-center text-[4.4cqw] font-bold'
            }
          >
            {t('decline')}
          </div>
        </div>
      </div>

      <div className={'bg-card flex items-center gap-[3cqw] px-[4cqw] pt-[3cqw] pb-[9cqw]'}>
        <Paperclip aria-hidden={'true'} className={'text-soft size-[6cqw] shrink-0'} />
        <span
          className={
            'bg-background text-soft flex-1 rounded-full px-[4cqw] py-[2.4cqw] text-[4.4cqw]'
          }
        >
          {t('placeholder')}
        </span>
        <Mic aria-hidden={'true'} className={'text-soft size-[6cqw] shrink-0'} />
      </div>
    </div>
  );
}
