'use client';

import { Calendar, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MonthGrid } from '@/components/Calendar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TopBar } from '@/components/TopBar';
import { invalidateDaysOff } from '@/hooks/mutations';
import { useAdminDaysOff } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';

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

type TPickerMode = 'single' | 'range';

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isConsecutive = (prev: Date, next: Date): boolean => {
  const expected = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
  return sameDay(expected, next);
};

const expandRange = (start: Date, end: Date): Date[] => {
  const [from, to] = start <= end ? [start, end] : [end, start];
  const out: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const stop = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= stop) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

export default function DaysOffPage(): ReactNode {
  const t = useTranslations('AdminDaysOff');
  const tc = useTranslations('Common');
  const tdat = useTranslations('Dates');
  const te = useTranslations('Errors');

  const formatDate = (date: Date): string => {
    const dayName = tdat(`daysShort.${dayKeys[date.getDay()]}`);
    const monthName = tdat(`monthsGen.${monthGenKeys[date.getMonth()]}`);
    return `${dayName}, ${date.getDate()} ${monthName}`;
  };

  const formatShort = (date: Date): string => {
    const monthName = tdat(`monthsGen.${monthGenKeys[date.getMonth()]}`);
    return `${date.getDate()} ${monthName}`;
  };

  const { data: daysOff, isLoading, mutate } = useAdminDaysOff();
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [mode, setMode] = useState<TPickerMode>('single');
  const [displayMonth, setDisplayMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [reason, setReason] = useState('');

  const daysOffIsoList = useMemo(() => daysOff.map((d) => d.date.slice(0, 10)), [daysOff]);
  const existingDaysOffSet = useMemo(() => new Set(daysOffIsoList), [daysOffIsoList]);

  /***************************************************************************************************
   * Auto-promote contiguous single selections (≥2 days, no gaps) into range mode so the
   * user sees the visual range bar without flipping the toggle manually. Debounced by 2s
   * so rapid consecutive picks don't prematurely switch modes mid-selection. A suppression
   * flag blocks one promotion cycle after the user manually toggles back to Single — so
   * the dates we just restored from a range don't immediately re-promote.
   ***************************************************************************************************/
  const debouncedSelectedDates = useDebounce(selectedDates, 2000);
  const suppressPromoteRef = useRef(false);
  useEffect(() => {
    if (mode !== 'single' || debouncedSelectedDates.length < 2) {
      return;
    }
    if (debouncedSelectedDates !== selectedDates) {
      return;
    }
    if (suppressPromoteRef.current) {
      suppressPromoteRef.current = false;
      return;
    }
    const sorted = [...debouncedSelectedDates].sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
      if (!isConsecutive(sorted[i - 1], sorted[i])) {
        return;
      }
    }
    setMode('range');
    setRangeStart(sorted[0]);
    setRangeEnd(sorted[sorted.length - 1]);
    setSelectedDates([]);
  }, [mode, debouncedSelectedDates, selectedDates]);

  const rangeDates = useMemo((): Date[] => {
    if (mode !== 'range' || !rangeStart) {
      return [];
    }
    if (!rangeEnd) {
      return [rangeStart];
    }
    return expandRange(rangeStart, rangeEnd);
  }, [mode, rangeStart, rangeEnd]);

  const highlighted = mode === 'single' ? selectedDates : undefined;
  const rangeEndpoints = useMemo(() => {
    if (mode !== 'range' || !rangeStart) {
      return { start: null, end: null };
    }
    if (!rangeEnd) {
      return { start: rangeStart, end: rangeStart };
    }
    const [from, to] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    return { start: from, end: to };
  }, [mode, rangeStart, rangeEnd]);

  const datesToSubmit = useMemo((): string[] => {
    const source = mode === 'single' ? selectedDates : rangeDates;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of source) {
      const iso = formatDateISO(d);
      if (seen.has(iso) || existingDaysOffSet.has(iso)) {
        continue;
      }
      seen.add(iso);
      out.push(iso);
    }
    return out;
  }, [mode, selectedDates, rangeDates, existingDaysOffSet]);

  const resetPicker = (): void => {
    setSelectedDates([]);
    setRangeStart(null);
    setRangeEnd(null);
    setReason('');
  };

  const handleModeChange = (next: TPickerMode): void => {
    if (next === mode) {
      return;
    }
    if (next === 'single') {
      const carried = rangeStart
        ? rangeEnd
          ? expandRange(rangeStart, rangeEnd)
          : [rangeStart]
        : [];
      if (carried.length > 0) {
        suppressPromoteRef.current = true;
        setSelectedDates((prev) => {
          const seen = new Set(prev.map(formatDateISO));
          const merged = [...prev];
          for (const d of carried) {
            const iso = formatDateISO(d);
            if (!seen.has(iso)) {
              seen.add(iso);
              merged.push(d);
            }
          }
          return merged;
        });
      }
      setRangeStart(null);
      setRangeEnd(null);
    } else {
      if (selectedDates.length >= 2) {
        const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
        let contiguous = true;
        for (let i = 1; i < sorted.length; i++) {
          if (!isConsecutive(sorted[i - 1], sorted[i])) {
            contiguous = false;
            break;
          }
        }
        if (contiguous) {
          setRangeStart(sorted[0]);
          setRangeEnd(sorted[sorted.length - 1]);
          setSelectedDates([]);
        }
      }
    }
    setMode(next);
  };

  const handleSelectDate = (date: Date): void => {
    if (mode === 'single') {
      const iso = formatDateISO(date);
      if (existingDaysOffSet.has(iso)) {
        return;
      }
      /***************************************************************************************************
       * Any deliberate pick in single mode means the user is actively composing a new selection,
       * so the "just-restored from range" suppression no longer applies.
       ***************************************************************************************************/
      suppressPromoteRef.current = false;
      setSelectedDates((prev) => {
        const exists = prev.some((d) => formatDateISO(d) === iso);
        return exists ? prev.filter((d) => formatDateISO(d) !== iso) : [...prev, date];
      });
      return;
    }
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    if (sameDay(date, rangeStart)) {
      setRangeEnd(date);
      return;
    }
    if (date < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(date);
    } else {
      setRangeEnd(date);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (datesToSubmit.length === 0) {
      return;
    }
    setSaving(true);
    try {
      await api.admin.createDayOffsBatch(datesToSubmit, reason || undefined);
      await mutate();
      invalidateDaysOff();
      setShowCalendar(false);
      resetPicker();
    } catch (err) {
      console.error('Failed to add days off:', err);
      toast.error(err instanceof Error ? err.message : te('addDayOffFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDayOff = async (id: string): Promise<void> => {
    const previousDaysOff = daysOff;
    mutate(
      daysOff.filter((d) => d.id !== id),
      false,
    );

    try {
      await api.admin.deleteDayOff(id);
      invalidateDaysOff();
    } catch (err) {
      console.error('Failed to delete day off:', err);
      toast.error(te('deleteDayOffFailed'));
      mutate(previousDaysOff, false);
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

  if (showCalendar) {
    const rangeReady = mode === 'range' && rangeStart && rangeEnd;
    const submitLabel = saving
      ? tc('saving')
      : datesToSubmit.length <= 1
        ? t('addDayOff')
        : t('addDaysOff', { count: datesToSubmit.length });

    return (
      <div>
        <TopBar
          title={t('selectDate')}
          showBack
          onBack={() => {
            setShowCalendar(false);
            resetPicker();
          }}
        />

        <div className={'space-y-4 p-4'}>
          {/***************************************************************************************************
           * Mode toggle.
           ***************************************************************************************************/}
          <div className={'bg-card flex rounded-xl p-1'}>
            {(['single', 'range'] as TPickerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-brand text-white' : 'text-muted-foreground'
                }`}
              >
                {m === 'single' ? t('modeSingle') : t('modeRange')}
              </button>
            ))}
          </div>

          <MonthGrid
            displayDate={displayMonth}
            selectedDate={null}
            selectedDates={highlighted}
            rangeStart={rangeEndpoints.start}
            rangeEnd={rangeEndpoints.end}
            onSelectDate={handleSelectDate}
            onPrevMonth={() =>
              setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
            }
            daysOff={daysOffIsoList}
            disableNonWorking={false}
            card
            onTitleClick={() => setDisplayMonth(new Date())}
          />

          {/***************************************************************************************************
           * Selection summary.
           ***************************************************************************************************/}
          <div className={'text-muted-foreground text-center text-sm'}>
            {mode === 'single'
              ? datesToSubmit.length === 0
                ? t('selectDates')
                : t('selectedCount', { count: datesToSubmit.length })
              : !rangeStart
                ? t('rangePickStart')
                : !rangeReady
                  ? t('rangePickEnd')
                  : t('rangeSummary', {
                      from: formatShort(rangeEndpoints.start ?? rangeStart!),
                      to: formatShort(rangeEndpoints.end ?? rangeEnd!),
                      count: datesToSubmit.length,
                    })}
          </div>

          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('reasonLabel')}</label>
            <input
              type={'text'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>

          <PrimaryButton onClick={handleSubmit} disabled={saving || datesToSubmit.length === 0}>
            {submitLabel}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-4 p-4'}>
        <button
          onClick={() => {
            resetPicker();
            setMode('single');
            setDisplayMonth(new Date());
            setShowCalendar(true);
          }}
          className={
            'border-border text-muted-foreground active:bg-card flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition-colors'
          }
        >
          <Plus className={'h-5 w-5'} />
          <span>{t('addDayOff')}</span>
        </button>

        {daysOff.length === 0 ? (
          <div className={'text-muted-foreground py-8 text-center'}>
            <Calendar className={'mx-auto mb-3 h-12 w-12 opacity-50'} />
            <p>{t('empty')}</p>
          </div>
        ) : (
          <div className={'space-y-2'}>
            {daysOff.map((dayOff) => (
              <div key={dayOff.id} className={'bg-card flex items-center gap-3 rounded-xl p-4'}>
                <div
                  className={'bg-dayoff-bg flex h-10 w-10 items-center justify-center rounded-full'}
                >
                  <Calendar className={'text-dayoff-text h-5 w-5'} />
                </div>
                <div className={'flex-1'}>
                  <p className={'text-foreground font-medium'}>
                    {formatDate(parseLocalDate(dayOff.date))}
                  </p>
                  {dayOff.reason && (
                    <p className={'text-muted-foreground text-sm'}>{dayOff.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    void handleRemoveDayOff(dayOff.id);
                  }}
                  className={
                    'text-muted-foreground hover:bg-card flex h-8 w-8 items-center justify-center rounded-full'
                  }
                >
                  <X className={'h-5 w-5'} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
