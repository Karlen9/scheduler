'use client';

import { CalendarCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { IntervalsEditor } from '@/components/IntervalsEditor';
import { PrimaryButton } from '@/components/PrimaryButton';
import { resolveTestAwareHref } from '@/lib/routes';

import type { TWorkingInterval } from '@/lib/types';
import type { ReactNode } from 'react';

type TDatesScheduleSectionProps = {
  defaultIntervals: TWorkingInterval[];
  onChangeIntervals: (intervals: TWorkingInterval[]) => void;
  /** True once the specialist is really in dates mode (the link to the calendar is useful). */
  isDatesModeSaved: boolean;
  /** Open dates within the next two weeks. */
  openCount: number;
  isSaving: boolean;
  onSave: () => void;
};

/***************************************************************************************************
 * "By dates" tab of the schedule settings: default hours editor, a hint and a link card to the
 * work-days calendar.
 *
 * Parameters:
 * - defaultIntervals: Hours applied to every opened date that has no hours of its own.
 * - onChangeIntervals: Receives the edited default hours.
 * - isDatesModeSaved: Whether the backend already works in dates mode.
 * - openCount: Number of open dates in the next 14 days (card subtitle).
 * - isSaving: Disables the save button while a request is in flight.
 * - onSave: Starts saving the mode and the default hours.
 ***************************************************************************************************/
export function DatesScheduleSection({
  defaultIntervals,
  onChangeIntervals,
  isDatesModeSaved,
  openCount,
  isSaving,
  onSave,
}: TDatesScheduleSectionProps): ReactNode {
  const t = useTranslations('AdminSchedule');
  const tc = useTranslations('Common');
  const pathname = usePathname();

  return (
    <div className={'space-y-5'} data-testid={'dates-schedule-section'}>
      <div className={'space-y-3'}>
        <div>
          <h3 className={'text-foreground text-base font-semibold'}>{t('defaultHours')}</h3>
          <p className={'text-muted-foreground mt-1 text-sm'}>{t('datesHint')}</p>
        </div>
        <div className={'bg-card rounded-lg p-3'}>
          <IntervalsEditor intervals={defaultIntervals} onChange={onChangeIntervals} />
        </div>
      </div>

      {isDatesModeSaved ? (
        <Link
          href={resolveTestAwareHref(pathname, '/admin/settings/work-days')}
          className={'bg-card active:bg-surface-hover flex items-center gap-3 rounded-xl p-4'}
        >
          <div
            className={'bg-success flex h-8 w-8 shrink-0 items-center justify-center rounded-lg'}
          >
            <CalendarCheck className={'h-[18px] w-[18px] text-white'} />
          </div>
          <div className={'min-w-0 flex-1'}>
            <p className={'text-foreground text-[15px]'}>{t('workDays')}</p>
            <p className={'text-muted-foreground text-xs'}>
              {t('workDaysSubtitle', { count: openCount })}
            </p>
          </div>
          <ChevronRight className={'text-muted-foreground h-4 w-4 shrink-0'} />
        </Link>
      ) : (
        <p className={'text-muted-foreground text-center text-xs'}>{t('datesSaveFirst')}</p>
      )}

      <PrimaryButton onClick={onSave} disabled={isSaving}>
        {isSaving ? tc('saving') : tc('saveChanges')}
      </PrimaryButton>
    </div>
  );
}
