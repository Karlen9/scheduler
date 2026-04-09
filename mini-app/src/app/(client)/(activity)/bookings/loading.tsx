import { BookingCardSkeleton } from '@/components/LoadingSkeleton';

import type { ReactNode } from 'react';

export default function BookingsLoading(): ReactNode {
  return (
    <div className={'space-y-4 p-4'}>
      <div className={'bg-card h-6 w-28 animate-pulse rounded'} />
      <div className={'bg-card h-4 w-24 animate-pulse rounded'} />
      <div className={'space-y-3'}>
        <BookingCardSkeleton />
        <BookingCardSkeleton />
      </div>
    </div>
  );
}
