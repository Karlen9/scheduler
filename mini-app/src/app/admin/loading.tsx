import { PendingBookingCardSkeleton } from '@/components/LoadingSkeleton';

import type { ReactNode } from 'react';

export default function AdminLoading(): ReactNode {
  return (
    <div className={'space-y-6 p-4'}>
      <div className={'animate-pulse'}>
        <div className={'bg-card mb-3 h-5 w-36 rounded'} />
        <div className={'bg-card h-24 rounded-xl'} />
      </div>
      <div className={'animate-pulse'}>
        <div className={'bg-card mb-3 h-5 w-28 rounded'} />
        <div className={'bg-card mb-4 h-10 rounded-xl'} />
        <div className={'space-y-2'}>
          <PendingBookingCardSkeleton />
          <PendingBookingCardSkeleton />
        </div>
      </div>
    </div>
  );
}
