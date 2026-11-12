'use client';

import { Repeat, RotateCcw } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { MonthGrid } from '@/components/Calendar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TopBar } from '@/components/TopBar';
import { invalidateWorkDates } from '@/hooks/mutations';
import { useAdminRoom, useAdminScheduleContext } from '@/hooks/queries';
import { api } from '@/lib/api';
import { WorkDatesConflictError } from '@/lib/api-error';
import { formatDateISO, parseDateParam } from '@/lib/helpers';
import { DEFAULT_WORK_INTERVAL } from '@/lib/intervals';
import { resolveTestAwareHref } from '@/lib/routes';
import { isDatesMode } from '@/lib/work-calendar';
import {
  countWorkDateChanges,
  diffWorkDates,
  draftFromWorkDates,
  planAlternatingWeeks,
  planRepeatLastWeek,
} from '@/lib/work-days-draft';

import { AlternatingWeeksSheet } from './AlternatingWeeksSheet';
import { RoomWorkDays } from './RoomWorkDays';
import { WorkDaySheet } from './WorkDaySheet';

import type { TWorkingInterval } from '@/lib/types';
import type { TAlternatingWeeksParams, TWorkDaysDraft } from '@/lib/work-days-draft';
import type { ReactNode } from 'react';

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const monthGenKeys = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

/***************************************************************************************************
 * Work-days calendar (dates schedule mode): the specialist opens dates, edits their hours or
 * closes them. All edits live in a local draft; the diff against the server state is sent in
 * a single request when the specialist presses Save.
 ***************************************************************************************************/
function SoloWorkDays(): ReactNode {
  const t = useTranslations('AdminWorkDays');
  const tc = useTranslations('Common');
  const tdat = useTranslations('Dates');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const pathname = usePathname();

  const { data: scheduleData, isLoading } = useAdminScheduleContext();

  const [draftState, setDraftState] = useState<TWorkDaysDraft | null>(null);
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alternatingOpen, setAlternatingOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const serverDraft = useMemo(() => draftFromWorkDates(scheduleData?.workDates), [scheduleData]);
  const draft = draftState ?? serverDraft;
  const changeCount = useMemo(() => countWorkDateChanges(serverDraft, draft), [serverDraft, draft]);
  const defaultIntervals = useMemo<TWorkingInterval[]>(
    () =>
      scheduleData?.defaultIntervals?.length
        ? scheduleData.defaultIntervals
        : [{ ...DEFAULT_WORK_INTERVAL }],
    [scheduleData],
  );

  // Active-booking counts come straight from the schedule context: `bookedDates` covers every
  // date (open or not), `bookingCount` on a work date is the same number for open dates.
  const bookingsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of scheduleData?.bookedDates ?? []) {
      counts.set(entry.date.slice(0, 10), entry.bookingCount);
    }
    for (const entry of scheduleData?.workDates ?? []) {
      const iso = entry.date.slice(0, 10);
      counts.set(iso, Math.max(counts.get(iso) ?? 0, entry.bookingCount ?? 0));
    }
    for (const [iso, count] of counts) {
      if (count <= 0) {
        counts.delete(iso);
      }
    }
    return counts;
  }, [scheduleData]);
  const markedDates = useMemo(() => new Set(bookingsByDate.keys()), [bookingsByDate]);

  const openDateObjects = useMemo(
    () =>
      [...draft.keys()].map((iso) => parseDateParam(iso)).filter((d): d is Date => d !== undefined),
    [draft],
  );

  const updateDraft = (mutate: (next: TWorkDaysDraft) => void): void => {
    setDraftState((prev) => {
      const next: TWorkDaysDraft = new Map(prev ?? serverDraft);
      mutate(next);
      return next;
    });
  };

  const formatShort = (iso: string): string => {
    const date = parseDateParam(iso);
    if (!date) {
      return iso;
    }
    return `${date.getDate()} ${tdat(`monthsGen.${monthGenKeys[date.getMonth()]}`)}`;
  };

  const sheetTitle = (iso: string | null): string => {
    const date = iso ? parseDateParam(iso) : undefined;
    if (!date) {
      return '';
    }
    return `${tdat(`daysFull.${dayKeys[date.getDay()]}`)}, ${formatShort(iso!)}`;
  };

  const handleSelectDate = (date: Date): void => {
    const iso = formatDateISO(date);
    if (iso < formatDateISO(new Date())) {
      // Past dates are read-only history.
      return;
    }
    if (draft.has(iso)) {
      setSheetDate(iso);
      setSheetOpen(true);
      return;
    }
    updateDraft((next) => next.set(iso, null));
  };

  const handleRepeatLastWeek = (): void => {
    const plan = planRepeatLastWeek(draft, new Date());
    if (!plan || plan.additions.length === 0) {
      toast(t('nothingToRepeat'));
      return;
    }
    updateDraft((next) => {
      for (const [iso, intervals] of plan.additions) {
        next.set(iso, intervals);
      }
    });
    const target = parseDateParam(plan.targetWeek);
    if (target) {
      setDisplayMonth(target);
    }
    toast.success(t('repeated', { count: plan.additions.length }));
  };

  const handleFillAlternating = (params: TAlternatingWeeksParams): void => {
    const dates = planAlternatingWeeks(draft, new Date(), params);
    if (dates.length === 0) {
      toast(t('nothingToFill'));
      return;
    }
    updateDraft((next) => {
      for (const iso of dates) {
        next.set(iso, null);
      }
    });
    toast.success(t('filled', { count: dates.length }));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await api.admin.updateWorkDates(diffWorkDates(serverDraft, draft));
      await invalidateWorkDates();
      setDraftState(null);
      toast.success(ts('saved'));
    } catch (err) {
      console.error('Failed to save work dates:', err);
      if (err instanceof WorkDatesConflictError) {
        toast.error(
          err.dates.length > 0
            ? t('closeConflict', { dates: err.dates.map(formatShort).join(', ') })
            : t('closeConflictUnknown'),
        );
      } else {
        toast.error(te('saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'flex min-h-[200px] items-center justify-center p-4'}>
          <div className={'text-muted-foreground'}>{tc('loading')}</div>
        </div>
      </div>
    );
  }

  const sheetIntervals = sheetDate ? (draft.get(sheetDate) ?? null) : null;
  const bookingsHref = sheetDate
    ? `${resolveTestAwareHref(pathname, '/admin/bookings')}?dateFrom=${sheetDate}&dateTo=${sheetDate}`
    : resolveTestAwareHref(pathname, '/admin/bookings');

  return (
    <div className={changeCount > 0 ? 'pb-28' : 'pb-6'}>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-4 p-4'}>
        <p className={'text-muted-foreground text-sm'}>{t('hint')}</p>

        {!isDatesMode(scheduleData) && (
          <p
            data-testid={'work-days-weekly-note'}
            className={'bg-status-warning-bg text-status-warning-text rounded-xl p-3 text-xs'}
          >
            {t('weeklyModeNote')}
          </p>
        )}

        {/***************************************************************************************************
         * Quick actions.
         ***************************************************************************************************/}
        <div className={'flex gap-2'}>
          <button
            type={'button'}
            onClick={handleRepeatLastWeek}
            className={
              'bg-card text-foreground flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium active:opacity-70'
            }
          >
            <RotateCcw className={'h-4 w-4 shrink-0'} />
            <span>{t('repeatLastWeek')}</span>
          </button>
          <button
            type={'button'}
            onClick={() => setAlternatingOpen(true)}
            className={
              'bg-card text-foreground flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium active:opacity-70'
            }
          >
            <Repeat className={'h-4 w-4 shrink-0'} />
            <span>{t('alternatingWeeks')}</span>
          </button>
        </div>

        <MonthGrid
          displayDate={displayMonth}
          selectedDate={null}
          selectedDates={openDateObjects}
          onSelectDate={handleSelectDate}
          onPrevMonth={() =>
            setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))
          }
          onNextMonth={() =>
            setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
          }
          markedDates={markedDates}
          disablePast
          disableNonWorking={false}
          card
          onTitleClick={() => setDisplayMonth(new Date())}
        />

        {/***************************************************************************************************
         * Legend.
         ***************************************************************************************************/}
        <div className={'text-muted-foreground flex items-center justify-center gap-5 text-xs'}>
          <div className={'flex items-center gap-1.5'}>
            <span className={'bg-brand h-3 w-3 rounded-full'} />
            <span>{t('legendOpen')}</span>
          </div>
          <div className={'flex items-center gap-1.5'}>
            <span className={'bg-brand h-1.5 w-1.5 rounded-full'} />
            <span>{t('legendBookings')}</span>
          </div>
        </div>
      </div>

      {/***************************************************************************************************
       * Sticky save bar, visible only while the draft differs from the server.
       ***************************************************************************************************/}
      {changeCount > 0 && (
        <div
          data-testid={'work-days-save-bar'}
          className={
            'bg-background/90 border-border fixed right-0 bottom-0 left-0 z-20 mx-auto flex max-w-[430px] items-center gap-3 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm'
          }
        >
          <span className={'text-foreground min-w-0 flex-1 text-sm font-medium'}>
            {t('changesCount', { count: changeCount })}
          </span>
          <button
            type={'button'}
            onClick={() => setDraftState(null)}
            disabled={saving}
            className={'text-muted-foreground px-2 py-2 text-sm font-medium disabled:opacity-40'}
          >
            {t('reset')}
          </button>
          <div className={'w-32'}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? tc('saving') : tc('save')}
            </PrimaryButton>
          </div>
        </div>
      )}

      <WorkDaySheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetTitle(sheetDate)}
        intervals={sheetIntervals}
        defaultIntervals={defaultIntervals}
        bookingsCount={sheetDate ? (bookingsByDate.get(sheetDate) ?? 0) : 0}
        bookingsHref={bookingsHref}
        onSetHours={(intervals) => {
          if (sheetDate) {
            updateDraft((next) => next.set(sheetDate, intervals));
          }
        }}
        onCloseDay={() => {
          if (sheetDate) {
            updateDraft((next) => next.delete(sheetDate));
          }
          setSheetOpen(false);
        }}
      />

      <AlternatingWeeksSheet
        isOpen={alternatingOpen}
        onClose={() => setAlternatingOpen(false)}
        onFill={handleFillAlternating}
      />
    </div>
  );
}

/***************************************************************************************************
 * Entry point: the room calendar when the specialist shares a room, otherwise the solo calendar.
 * A missing room, `{room: null}` and a failed room request all mean solo mode.
 ***************************************************************************************************/
export default function WorkDaysPage(): ReactNode {
  const t = useTranslations('AdminWorkDays');
  const tc = useTranslations('Common');
  const { data: roomData, isLoading } = useAdminRoom();

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'flex min-h-[200px] items-center justify-center p-4'}>
          <div className={'text-muted-foreground'}>{tc('loading')}</div>
        </div>
      </div>
    );
  }

  return roomData.room ? <RoomWorkDays roomData={roomData} /> : <SoloWorkDays />;
}
