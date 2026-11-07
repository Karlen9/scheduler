import { Check, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { accent, marker } from '@/lib/rich';

import { CtaButton } from './CtaButton';
import { PhoneFrame } from './PhoneFrame';

import type { ReactNode } from 'react';

export function HeroSection(): ReactNode {
  const t = useTranslations();

  return (
    <section id={'top'} aria-labelledby={'hero-title'} className={'px-3 pt-7 sm:px-4'}>
      <div
        data-hero-root={''}
        className={
          'hero-wash relative mx-auto max-w-[1180px] overflow-hidden rounded-[2rem] px-5 pt-14 shadow-[0_0_0_1px_var(--hairline)] sm:rounded-[2.5rem] sm:px-10 sm:pt-20 lg:pt-24'
        }
      >
        <div className={'mx-auto flex max-w-4xl flex-col items-center text-center'}>
          <p
            data-hero={'eyebrow'}
            className={
              'bg-card text-primary inline-flex items-center rounded-full px-4 py-1.5 text-[0.8125rem] font-semibold shadow-[0_0_0_1px_var(--hairline)]'
            }
          >
            {t('hero.eyebrow')}
          </p>
          <h1
            id={'hero-title'}
            data-hero={'title'}
            className={
              'mt-6 text-[2.125rem] leading-[1.06] font-extrabold sm:text-5xl lg:text-6xl xl:text-[4rem]'
            }
          >
            {t.rich('hero.title', { accent })}
          </h1>
          <p
            data-hero={'subtitle'}
            className={'text-soft mt-6 max-w-2xl text-base leading-relaxed sm:text-lg'}
          >
            {t('hero.subtitle')}
          </p>
          <div data-hero={'cta'} className={'mt-8 flex flex-col items-center gap-4'}>
            <CtaButton size={'lg'}>{t('cta.hero')}</CtaButton>
            <p className={'text-soft max-w-sm text-sm leading-snug font-medium text-balance'}>
              <Check
                aria-hidden={'true'}
                className={'text-success mr-2 inline-block size-4 align-[-0.2em]'}
              />
              {t.rich('cta.note', { mark: marker })}
            </p>
            <p
              className={
                'bg-card text-foreground max-w-md rounded-2xl px-4 py-2.5 text-sm leading-snug font-semibold text-balance shadow-[0_0_0_1px_var(--hairline)]'
              }
            >
              <UserPlus
                aria-hidden={'true'}
                className={'text-primary mr-2 inline-block size-4 align-[-0.2em]'}
              />
              {t('hero.noTelegram')}
            </p>
          </div>
        </div>

        <div
          className={
            'relative -mx-5 mt-12 h-[352px] overflow-hidden sm:-mx-10 sm:mt-14 sm:h-[400px] md:h-[440px] lg:h-[500px]'
          }
        >
          <div
            className={
              'flex w-full items-start justify-center gap-3 sm:gap-4 md:gap-5 [&>*]:shrink-0'
            }
          >
            <div
              data-hero={'phone'}
              className={'mt-12 w-[168px] sm:w-[172px] md:mt-14 md:w-[196px] lg:mt-16 lg:w-[224px]'}
            >
              <PhoneFrame screen={'request'} />
            </div>
            <div data-hero={'phone'} className={'w-[216px] md:w-[244px] lg:w-[272px]'}>
              <PhoneFrame screen={'booking'} priority />
            </div>
            <div
              data-hero={'phone'}
              className={'mt-12 w-[168px] sm:w-[172px] md:mt-14 md:w-[196px] lg:mt-16 lg:w-[224px]'}
            >
              <PhoneFrame screen={'calendar'} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
