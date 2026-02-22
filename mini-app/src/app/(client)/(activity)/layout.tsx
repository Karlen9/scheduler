import { ActivityBackButton } from '@/components/ActivityBackButton';

import type { ReactNode } from 'react';

export default function ActivityLayout({ children }: { children: React.ReactNode }): ReactNode {
  return (
    <>
      <ActivityBackButton href={'/'} />
      {children}
    </>
  );
}
