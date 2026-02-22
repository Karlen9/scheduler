import { Calendar, Clock, Repeat } from 'lucide-react';

import type { TRecurringSchedule } from '@/lib/types';
import type { ReactNode } from 'react';

type TScheduleInfoCardProps = {
  schedule: TRecurringSchedule;
  scheduleStatus: { color: string; border: string };
  scheduleStatusLabel: string;
  serviceName: string;
  daysLabel: string;
  dateRange: string | null;
  durationLabel: string;
  dayTimes: Record<string, string> | null;
};

export function ScheduleInfoCard({
  schedule,
  scheduleStatus,
  scheduleStatusLabel,
  serviceName,
  daysLabel,
  dateRange,
  durationLabel,
  dayTimes,
}: TScheduleInfoCardProps): ReactNode {
  return (
    <div className={`bg-card rounded-xl border-l-4 p-4 ${scheduleStatus.border}`}>
      <div className={'mb-3 flex items-start justify-between'}>
        <h3 className={'text-foreground text-base font-medium'}>{serviceName}</h3>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${scheduleStatus.color}`}
        >
          {scheduleStatusLabel}
        </span>
      </div>

      <div className={'space-y-2'}>
        {dayTimes ? (
          <div className={'flex items-center gap-2'}>
            <Clock className={'text-muted-foreground h-4 w-4 shrink-0'} />
            <span className={'text-foreground text-sm'}>
              {daysLabel}
              <span className={'text-muted-foreground'}>
                {' · '}
                {durationLabel}
              </span>
            </span>
          </div>
        ) : (
          <>
            <div className={'flex items-center gap-2'}>
              <Repeat className={'text-muted-foreground h-4 w-4 shrink-0'} />
              <span className={'text-foreground text-sm'}>{daysLabel}</span>
            </div>
            <div className={'flex items-center gap-2'}>
              <Clock className={'text-muted-foreground h-4 w-4 shrink-0'} />
              <span className={'text-foreground text-sm'}>
                {schedule.time}
                <span className={'text-muted-foreground'}>
                  {' · '}
                  {durationLabel}
                </span>
              </span>
            </div>
          </>
        )}
        {dateRange && (
          <div className={'flex items-center gap-2'}>
            <Calendar className={'text-muted-foreground h-4 w-4 shrink-0'} />
            <span className={'text-muted-foreground text-sm'}>{dateRange}</span>
          </div>
        )}
      </div>
    </div>
  );
}
