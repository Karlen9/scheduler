import type { ReactNode } from 'react';

export default function ClientRootLoading(): ReactNode {
  return (
    <div className={'animate-pulse'}>
      <div className={'bg-skeleton h-[280px] w-full'} />
      <div className={'bg-card relative -mt-6 space-y-4 rounded-t-2xl px-4 pt-6 pb-4'}>
        <div className={'bg-skeleton h-7 w-2/3 rounded'} />
        <div className={'bg-skeleton h-4 w-1/2 rounded'} />
        <div className={'bg-skeleton h-3 w-3/4 rounded'} />
        <div className={'flex gap-2 pt-2'}>
          <div className={'bg-skeleton h-12 flex-1 rounded-[28px]'} />
          <div className={'bg-skeleton h-12 flex-1 rounded-[28px]'} />
          <div className={'bg-skeleton h-12 w-12 rounded-[28px]'} />
        </div>
        <div className={'space-y-3 pt-4'}>
          <div className={'bg-skeleton h-5 w-24 rounded'} />
          <div className={'bg-skeleton h-16 rounded-xl'} />
          <div className={'bg-skeleton h-16 rounded-xl'} />
        </div>
      </div>
    </div>
  );
}
