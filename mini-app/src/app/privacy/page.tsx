import { LegalDocument } from '@/components/LegalDocument';
import { PRIVACY_RU } from '@/lib/legal/content';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
};

export default function PrivacyPage(): ReactNode {
  return <LegalDocument doc={PRIVACY_RU} />;
}
