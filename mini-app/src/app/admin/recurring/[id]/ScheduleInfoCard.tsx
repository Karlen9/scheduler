import { Calendar, Clock, Dumbbell, Repeat } from 'lucide-react';
import { ClientAvatar } from '@/components/ClientAvatar';
import { RecurringSchedule } from '@/lib/types';

interface ScheduleInfoCardProps {
  schedule: RecurringSchedule;
  scheduleStatus: { color: string; border: string };
  title: string;
  statusLabel: string;
  daysLabel: string;
  serviceName: string;
  dateRange: string | null;
  durationLabel: string;
  dayTimes: Record<string, string> | null;
}

export function ScheduleInfoCard({
  schedule,
  scheduleStatus,
  title,
  statusLabel,
  daysLabel,
  serviceName,
  dateRange,
  durationLabel,
  dayTimes,
}: ScheduleInfoCardProps) {
  return (
    <div className={`bg-card rounded-xl border-l-4 p-4 ${scheduleStatus.border}`}>
      <div className="mb-3 flex items-start justify-between">
        <h2 className="text-foreground text-base font-medium">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${scheduleStatus.color}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ClientAvatar
            name={schedule.clientDisplayName || schedule.clientName}
            photoUrl={schedule.clientPhotoUrl}
            size="sm"
          />
          <span className="text-foreground text-sm">
            {schedule.clientDisplayName || schedule.clientName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Dumbbell className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm">{serviceName}</span>
        </div>

        {dayTimes ? (
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm">
              {daysLabel}
              <span className="text-muted-foreground"> · {durationLabel}</span>
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Repeat className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-sm">{daysLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-sm">
                {schedule.time}
                <span className="text-muted-foreground"> · {durationLabel}</span>
              </span>
            </div>
          </>
        )}

        {dateRange && (
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-sm">{dateRange}</span>
          </div>
        )}
      </div>
    </div>
  );
}
