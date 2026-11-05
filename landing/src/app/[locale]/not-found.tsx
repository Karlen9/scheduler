import { getLocale, getTranslations } from 'next-intl/server';

import { CtaButton } from '@/components/CtaButton';
import { getPathname } from '@/i18n/navigation';

import type { ReactNode } from 'react';

export default async function NotFound(): Promise<ReactNode> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'notFound' });

  return (
    <main
      className={
        'container-page flex min-h-dvh flex-col items-center justify-center gap-6 text-center'
      }
    >
      <p className={'font-accent text-primary text-7xl font-medium italic'}>{'404'}</p>
      <h1 className={'text-3xl font-extrabold sm:text-4xl'}>{t('title')}</h1>
      <CtaButton icon={false} href={getPathname({ locale, href: '/' })} className={'mt-2'}>
        {t('home')}
      </CtaButton>
    </main>
  );
}
