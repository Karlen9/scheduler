import { LegalDocument } from '@/components/LegalDocument';
import { TERMS_RU } from '@/lib/legal/content';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Пользовательское соглашение',
};

export default function TermsPage(): ReactNode {
  return <LegalDocument doc={TERMS_RU} />;
}
