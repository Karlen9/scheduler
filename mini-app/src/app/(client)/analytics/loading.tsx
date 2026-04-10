import { TopBar } from '@/components/TopBar';

import type { ReactNode } from 'react';

export default function AnalyticsLoading(): ReactNode {
  return (
    <div>
      <TopBar title={' '} />
      <div className={'space-y-4 p-4'}>
        <div className={'grid grid-cols-2 gap-3'}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={'bg-card animate-pulse rounded-xl p-4'}>
              <div className={'bg-border h-3 w-20 rounded'} />
              <div className={'mt-4 flex items-center justify-between'}>
                <div className={'bg-border h-8 w-8 rounded-full'} />
                <div className={'bg-border h-8 w-16 rounded'} />
              </div>
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={'space-y-2'}>
            <div className={'bg-card h-5 w-28 animate-pulse rounded'} />
            <div className={'bg-card animate-pulse rounded-xl p-4'}>
              <div className={'space-y-3'}>
                {Array.from({ length: index === 1 ? 3 : 4 }).map((__, rowIndex) => (
                  <div key={rowIndex} className={'bg-border h-4 rounded'} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
