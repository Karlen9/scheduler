'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { getTelegramWebApp } from '@/lib/telegram';

import type { TLegalDoc } from '@/lib/legal/content';
import type { ReactNode } from 'react';

type TLegalDocumentProps = {
  doc: TLegalDoc;
};

export function LegalDocument({ doc }: TLegalDocumentProps): ReactNode {
  const router = useRouter();

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      return;
    }
    const onBack = (): void => {
      router.back();
    };
    webApp.BackButton.show();
    webApp.BackButton.onClick(onBack);
    return () => {
      webApp.BackButton.offClick(onBack);
      webApp.BackButton.hide();
    };
  }, [router]);

  return (
    <div className={'bg-background min-h-screen'}>
      <div
        className={'bg-card border-border sticky top-0 z-10 flex h-14 items-center border-b px-4'}
      >
        <button
          type={'button'}
          onClick={() => router.back()}
          className={'text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md'}
          aria-label={'Назад'}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className={'text-foreground flex-1 pr-9 text-center text-base font-semibold'}>
          {doc.title}
        </h1>
      </div>

      <div className={'mx-auto max-w-2xl px-4 py-6'}>
        <p className={'text-muted-foreground mb-4 text-sm'}>
          {'Обновлено: '}
          {doc.updated}
        </p>

        {doc.sections.map((section, idx) => (
          <div key={idx}>
            {section.heading && (
              <h2 className={'text-foreground mt-6 mb-2 text-base font-semibold'}>
                {section.heading}
              </h2>
            )}
            {section.body
              .split('\n\n')
              .map((paragraph) => paragraph.trim())
              .filter((paragraph) => paragraph.length > 0)
              .map((paragraph, pIdx) => (
                <p key={pIdx} className={'text-foreground/90 mb-2 text-sm leading-relaxed'}>
                  {paragraph}
                </p>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
