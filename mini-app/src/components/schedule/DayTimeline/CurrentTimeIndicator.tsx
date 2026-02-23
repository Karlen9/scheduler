import type { TCurrentTimeIndicatorProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function CurrentTimeIndicator({ top }: TCurrentTimeIndicatorProps): ReactNode {
  return (
    <div
      className={'pointer-events-none absolute right-0 left-10 z-10 flex items-center'}
      style={{ top }}
    >
      <div className={'bg-destructive -ml-1 h-2.5 w-2.5 rounded-full'} />
      <div className={'border-destructive flex-1 border-t-2'} />
    </div>
  );
}
