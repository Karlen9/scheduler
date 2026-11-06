import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FAQ_GROUPS } from '@/lib/faq';
import { accent } from '@/lib/rich';

import { SectionHeading } from './SectionHeading';

import type { ReactNode } from 'react';

export function FaqSection(): ReactNode {
  const t = useTranslations('faq');

  return (
    <section
      id={'faq'}
      aria-labelledby={'faq-title'}
      className={'container-page py-16 sm:py-20 lg:py-28'}
    >
      <SectionHeading id={'faq-title'} title={t.rich('title', { accent })} />
      <div className={'mx-auto max-w-3xl'}>
        {FAQ_GROUPS.map((group) => (
          <div key={group.id} className={'mt-10 first:mt-0'}>
            <h3 className={'text-soft mb-3 px-2 text-sm font-bold tracking-wider uppercase'}>
              {t(`groups.${group.id}`)}
            </h3>
            <div className={'surface divide-hairline divide-y overflow-hidden rounded-3xl'}>
              {group.items.map((n) => (
                <details key={n} name={'faq'} className={'group'}>
                  <summary
                    className={
                      'hover:bg-foreground/4 flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[0.9375rem] font-semibold transition-colors sm:px-6 sm:text-base'
                    }
                  >
                    <span>{t(`items.i${n}.q`)}</span>
                    <span
                      className={
                        'bg-foreground/6 flex size-8 shrink-0 items-center justify-center rounded-full'
                      }
                    >
                      <ChevronDown
                        aria-hidden={'true'}
                        className={'size-4 transition-transform duration-200 group-open:rotate-180'}
                      />
                    </span>
                  </summary>
                  <p className={'text-soft px-5 pb-5 text-[0.9375rem] leading-relaxed sm:px-6'}>
                    {t(`items.i${n}.a`)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
