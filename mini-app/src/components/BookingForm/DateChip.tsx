import { monthShortCapKeys } from '@/lib/mappings';
import { useTranslations } from 'next-intl';

export function DateChip({
  date,
  time,
  endTime,
  active,
  onClick,
}: {
  date: Date;
  time?: string;
  endTime?: string;
  active: boolean;
  onClick: () => void;
}) {
  const td = useTranslations('Dates');
  const monthKey = monthShortCapKeys[date.getMonth()];

  return (
    <button
      onClick={onClick}
      className={`flex min-w-[56px] shrink-0 flex-col items-center rounded-xl px-3 py-2 transition-all ${
        active
          ? 'border-border outline-brand bg-card border outline-2'
          : 'border-border bg-card border'
      }`}
    >
      <span className="text-foreground text-lg font-semibold">{date.getDate()}</span>
      <span className="text-muted-foreground text-[10px]">{td(`monthsShortCap.${monthKey}`)}</span>
      {time ? (
        <>
          <span className="text-foreground mt-1 text-[10px]">{time}</span>
          {endTime && <span className="text-muted-foreground text-[10px]">{endTime}</span>}
        </>
      ) : (
        <span className="text-muted-foreground mt-1 text-sm">?</span>
      )}
    </button>
  );
}
