import type { ReactNode } from 'react';

export default function AdminClientsLoading(): ReactNode {
  return (
    <div className={'space-y-3 p-4'}>
      <div className={'bg-card h-6 w-32 animate-pulse rounded'} />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={'bg-card flex animate-pulse items-center gap-3 rounded-xl p-4'}>
          <div className={'bg-border h-10 w-10 rounded-full'} />
          <div className={'flex-1 space-y-2'}>
            <div className={'bg-border h-4 w-1/2 rounded'} />
            <div className={'bg-border h-3 w-1/3 rounded'} />
          </div>
        </div>
      ))}
    </div>
  );
}
