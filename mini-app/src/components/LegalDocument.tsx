'use client';

import type { TLegalDoc } from '@/lib/legal/content';
import type { ReactNode } from 'react';

type TLegalDocumentProps = {
  doc: TLegalDoc;
};

export function LegalDocument({ doc }: TLegalDocumentProps): ReactNode {
  return (
    <div className={'bg-background min-h-screen'}>
      <div
        className={
          'bg-card border-border sticky top-0 z-10 flex h-14 items-center justify-center border-b px-4'
        }
      >
        <h1 className={'text-foreground text-base font-semibold'}>{doc.title}</h1>
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
            {section.paragraphs.map((paragraph, pIdx) => (
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
