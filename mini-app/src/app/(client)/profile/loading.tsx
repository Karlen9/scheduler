import type { ReactNode } from 'react';

export default function ProfileLoading(): ReactNode {
  return (
    <div className={'animate-pulse space-y-6 p-4'}>
      <div className={'flex justify-center pt-2'}>
        <div className={'bg-card h-24 w-24 rounded-full'} />
      </div>
      <div className={'space-y-4'}>
        <div>
          <div className={'bg-card mb-2 h-4 w-10 rounded'} />
          <div className={'bg-card h-12 rounded-lg'} />
        </div>
        <div>
          <div className={'bg-card mb-2 h-4 w-16 rounded'} />
          <div className={'bg-card h-12 rounded-lg'} />
        </div>
      </div>
      <div className={'bg-card h-12 rounded-lg'} />
    </div>
  );
}
