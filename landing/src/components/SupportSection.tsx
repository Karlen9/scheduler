import { Headset } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CONTACT_EMAIL } from '@/lib/site';

import { CtaButton } from './CtaButton';

import type { ReactNode } from 'react';

// The email is injected as an element, so the translated sentence is split around a marker.
const EMAIL_SLOT = '\u0001';

export function SupportSection(): ReactNode {
  const t = useTranslations('support');
  const emailParts = t('email', { email: EMAIL_SLOT }).split(EMAIL_SLOT);

  return (
    <section
      id={'support'}
      aria-labelledby={'support-title'}
      className={'container-page py-6 sm:py-10'}
    >
      <div
        data-fade={''}
        className={'surface mx-auto max-w-3xl rounded-3xl p-8 text-center sm:p-10'}
      >
        <span
          className={
            'bg-primary/12 text-primary mx-auto flex size-14 items-center justify-center rounded-2xl'
          }
        >
          <Headset aria-hidden={'true'} className={'size-7'} />
        </span>
        <h2 id={'support-title'} className={'mt-5 text-2xl font-extrabold sm:text-3xl'}>
          {t('title')}
        </h2>
        <p className={'text-soft mx-auto mt-3 max-w-xl text-base leading-relaxed'}>{t('text')}</p>
        <CtaButton className={'mt-7 w-full sm:w-auto'}>{t('cta')}</CtaButton>
        {CONTACT_EMAIL ? (
          <p className={'text-soft mt-5 text-sm'}>
            {emailParts[0]}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={'text-primary font-semibold underline-offset-4 hover:underline'}
            >
              {CONTACT_EMAIL}
            </a>
            {emailParts[1]}
          </p>
        ) : null}
      </div>
    </section>
  );
}
