'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { roomColorVar } from '@/lib/room';

import type { TRoomAlternatingParams } from '@/lib/room';
import type { TAlternatingWeeksParams, TWeekday } from '@/lib/work-days-draft';
import type { ReactNode } from 'react';

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const dayOrder: TWeekday[] = [1, 2, 3, 4, 5, 6, 0];
const HORIZONS = [4, 8] as const;

type TAssignableMember = { id: string; label: string; color: string };

type TAlternatingWeeksSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onFill: (params: TAlternatingWeeksParams) => void;
  /** Room mode: one weekday row per assignable member (me + offline colleagues). */
  members?: TAssignableMember[];
  onFillRoom?: (params: TRoomAlternatingParams) => void;
};

function WeekdayChips({
  label,
  selected,
  onToggle,
  testId,
  color,
}: {
  label: string;
  selected: TWeekday[];
  onToggle: (day: TWeekday) => void;
  testId: string;
  color?: string;
}): ReactNode {
  const tdat = useTranslations('Dates');
  return (
    <div className={'space-y-2'} data-testid={testId}>
      <p className={'text-foreground flex items-center gap-2 text-sm font-medium'}>
        {color && (
          <span
            className={'h-3 w-3 rounded-full'}
            style={{ backgroundColor: roomColorVar(color) }}
          />
        )}
        {label}
      </p>
      <div className={'flex flex-wrap gap-2'}>
        {dayOrder.map((day) => (
          <button
            key={day}
            type={'button'}
            aria-pressed={selected.includes(day)}
            onClick={() => onToggle(day)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              selected.includes(day)
                ? 'bg-brand text-white'
                : 'bg-surface-hover text-muted-foreground'
            }`}
          >
            {tdat(`daysShort.${dayKeys[day]}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <div className={'bg-background flex rounded-xl p-1'}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type={'button'}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            value === option.value ? 'bg-brand text-white' : 'text-muted-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/***************************************************************************************************
 * "Alternating weeks" generator: two weekday sets (week A / week B), a start week and a horizon.
 * Confirming hands the parameters to the page, which adds the dates to its draft. Nothing is
 * ever removed by this sheet.
 ***************************************************************************************************/
export function AlternatingWeeksSheet({
  isOpen,
  onClose,
  onFill,
  members,
  onFillRoom,
}: TAlternatingWeeksSheetProps): ReactNode {
  const t = useTranslations('AdminWorkDays');
  const [weekA, setWeekA] = useState<TWeekday[]>([]);
  const [weekB, setWeekB] = useState<TWeekday[]>([]);
  const [startOffset, setStartOffset] = useState<0 | 1>(0);
  const [horizon, setHorizon] = useState<number>(4);
  const [roomA, setRoomA] = useState<Record<string, TWeekday[]>>({});
  const [roomB, setRoomB] = useState<Record<string, TWeekday[]>>({});

  const toggleDay = (list: TWeekday[], day: TWeekday): TWeekday[] =>
    list.includes(day) ? list.filter((d) => d !== day) : [...list, day];

  const roomMode = members !== undefined;
  const hasAny = (pattern: Record<string, TWeekday[]>): boolean =>
    Object.values(pattern).some((days) => days.length > 0);
  const canFill = roomMode ? hasAny(roomA) || hasAny(roomB) : weekA.length > 0 || weekB.length > 0;

  const toggleRoom = (
    setter: (updater: (prev: Record<string, TWeekday[]>) => Record<string, TWeekday[]>) => void,
    id: string,
    day: TWeekday,
  ): void => setter((prev) => ({ ...prev, [id]: toggleDay(prev[id] ?? [], day) }));

  const renderRoomWeek = (
    heading: string,
    pattern: Record<string, TWeekday[]>,
    setter: (updater: (prev: Record<string, TWeekday[]>) => Record<string, TWeekday[]>) => void,
    key: 'a' | 'b',
  ): ReactNode => (
    <div className={'space-y-3'} data-testid={`alt-room-week-${key}`}>
      <p className={'text-foreground text-sm font-semibold'}>{heading}</p>
      {(members ?? []).map((member) => (
        <WeekdayChips
          key={member.id}
          label={member.label}
          color={member.color}
          selected={pattern[member.id] ?? []}
          onToggle={(day) => toggleRoom(setter, member.id, day)}
          testId={`alt-week-${key}-${member.id}`}
        />
      ))}
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t('alternatingTitle')}>
      <div className={'space-y-4'}>
        <p className={'text-muted-foreground text-sm'}>{t('alternatingHint')}</p>

        {roomMode ? (
          <>
            {renderRoomWeek(t('weekA'), roomA, setRoomA, 'a')}
            {renderRoomWeek(t('weekB'), roomB, setRoomB, 'b')}
          </>
        ) : (
          <>
            <WeekdayChips
              label={t('weekA')}
              selected={weekA}
              onToggle={(day) => setWeekA((prev) => toggleDay(prev, day))}
              testId={'alt-week-a'}
            />
            <WeekdayChips
              label={t('weekB')}
              selected={weekB}
              onToggle={(day) => setWeekB((prev) => toggleDay(prev, day))}
              testId={'alt-week-b'}
            />
          </>
        )}

        <Segmented<0 | 1>
          options={[
            { value: 0, label: t('startThisWeek') },
            { value: 1, label: t('startNextWeek') },
          ]}
          value={startOffset}
          onChange={setStartOffset}
        />

        <Segmented<number>
          options={HORIZONS.map((weeks) => ({
            value: weeks,
            label: t('horizonWeeks', { count: weeks }),
          }))}
          value={horizon}
          onChange={setHorizon}
        />

        <PrimaryButton
          disabled={!canFill}
          onClick={() => {
            if (roomMode) {
              onFillRoom?.({
                weekA: roomA,
                weekB: roomB,
                startOffsetWeeks: startOffset,
                horizonWeeks: horizon,
              });
            } else {
              onFill({ weekA, weekB, startOffsetWeeks: startOffset, horizonWeeks: horizon });
            }
            onClose();
          }}
        >
          {t('fill')}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
