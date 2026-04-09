import type { ReactNode } from 'react';

export default function ScheduleLoading(): ReactNode {
  return (
    <div className={'space-y-4 p-4'}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={'bg-card animate-pulse rounded-xl p-4'}>
          <div className={'mb-4 flex items-center justify-between'}>
            <div className={'bg-border h-5 w-24 rounded'} />
            <div className={'bg-border h-6 w-11 rounded-full'} />
          </div>
          <div className={'space-y-2'}>
            <div className={'bg-border h-12 rounded-lg'} />
            <div className={'bg-border h-12 rounded-lg'} />
          </div>
        </div>
      ))}
    </div>
  );
}
