import type { TBarChartProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the bar chart UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function BarChart({ data, valueFormatter }: TBarChartProps): ReactNode {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <div className={'space-y-3'}>
      <div className={'flex h-40 items-end gap-2'}>
        {data.map((item) => {
          const height =
            maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 10 : 0) : 0;
          return (
            <div key={item.label} className={'flex flex-1 flex-col items-center justify-end gap-2'}>
              <span className={'text-muted-foreground text-[11px]'}>
                {valueFormatter ? valueFormatter(item.value) : item.value}
              </span>
              <div className={'bg-brand/12 flex h-28 w-full items-end rounded-t-xl'}>
                <div
                  className={'bg-brand w-full rounded-t-xl transition-[height] duration-300'}
                  style={{ height: `${height}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className={'text-muted-foreground flex gap-2 text-[11px] font-medium'}>
        {data.map((item) => (
          <span key={item.label} className={'min-w-0 flex-1 text-center'}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
