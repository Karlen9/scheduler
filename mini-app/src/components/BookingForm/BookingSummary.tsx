import { addMinutesToTime } from '@/lib/helpers';
import { monthShortCapKeys, monthGenKeys } from '@/lib/mappings';
import { SessionType } from '@/lib/types';
import { useTranslations } from 'next-intl';

export function BookingSummary({
  date,
  service,
  time,
  minLabel,
}: {
  date: Date;
  service: SessionType;
  time: string | null;
  minLabel: string;
}) {
  const td = useTranslations('Dates');
  const monthShortCapKey = monthShortCapKeys[date.getMonth()];
  const monthGenKey = monthGenKeys[date.getMonth()];
  const endTime = time ? addMinutesToTime(time, service.durationMinutes) : null;
  return (
    <div className="bg-card flex items-center gap-4 rounded-xl p-4">
      <div className="flex w-14 flex-col items-center justify-center">
        <span className="text-foreground text-2xl leading-none font-bold">{date.getDate()}</span>
        <span className="text-muted-foreground mt-0.5 text-xs">
          {td(`monthsShortCap.${monthShortCapKey}`)}
        </span>
      </div>
      <div className="flex-1 space-y-0.5">
        <p className="text-muted-foreground text-xs">
          {date.getDate()} {td(`monthsGen.${monthGenKey}`)}
        </p>
        <p className="text-foreground truncate text-sm">{service.name}</p>
        {time && (
          <p className="text-muted-foreground text-xs">
            {time} &ndash; {endTime} &middot; {service.durationMinutes} {minLabel}
          </p>
        )}
      </div>
    </div>
  );
}
