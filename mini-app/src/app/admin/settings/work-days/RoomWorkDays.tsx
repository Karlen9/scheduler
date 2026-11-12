'use client';

import { Copy, Repeat, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { MonthGrid } from '@/components/Calendar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TopBar } from '@/components/TopBar';
import { invalidateRoom, invalidateWorkDates } from '@/hooks/mutations';
import { useAdminScheduleContext } from '@/hooks/queries';
import { api } from '@/lib/api';
import { RoomError, WorkDatesConflictError } from '@/lib/api-error';
import { copyText } from '@/lib/clipboard';
import { formatDateISO, parseDateParam } from '@/lib/helpers';
import { DEFAULT_WORK_INTERVAL } from '@/lib/intervals';
import {
  buildBookingCounts,
  buildOwnerMap,
  buildScheduleLines,
  effectiveOwner,
  overridesToAssignments,
  planRoomAlternatingWeeks,
  planRoomRepeatLastWeek,
  roomColorVar,
  scheduleMonthSpan,
  setOverride,
} from '@/lib/room';
import { resolveTestAwareHref } from '@/lib/routes';
import { draftFromWorkDates } from '@/lib/work-days-draft';

import { AlternatingWeeksSheet } from './AlternatingWeeksSheet';
import { RoomDaySheet } from './RoomDaySheet';
import { WorkDaySheet } from './WorkDaySheet';

import type { TRoomDayOption } from './RoomDaySheet';
import type { TRoomAlternatingParams, TRoomHours, TRoomOverrides } from '@/lib/room';
import type { TRoomResponse, TWorkingInterval } from '@/lib/types';
import type { ReactNode } from 'react';

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const monthKeys = [
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
const COPY_DAYS = 28;

function intervalsKey(intervals: TWorkingInterval[] | null | undefined): string {
  return intervals?.length ? JSON.stringify(intervals.map((i) => [i.startTime, i.endTime])) : '';
}

type TRoomWorkDaysProps = {
  roomData: TRoomResponse;
};

/***************************************************************************************************
 * Work-days calendar of a shared room. Every date has at most one owner shown by colour. The
 * caller may assign free days and offline colleagues' days to themself, to an offline colleague
 * or to nobody; a linked colleague's day can only be requested. Edits (assignments and the
 * caller's own hours) live in a local draft; Save sends the assignments to
 * PUT /api/admin/room/days and the hour changes to PUT /api/admin/work-dates.
 ***************************************************************************************************/
export function RoomWorkDays({ roomData }: TRoomWorkDaysProps): ReactNode {
  const t = useTranslations('AdminWorkDays');
  const tr = useTranslations('AdminRoom');
  const tc = useTranslations('Common');
  const tdat = useTranslations('Dates');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const pathname = usePathname();
  const locale = useLocale();

  const { data: scheduleData } = useAdminScheduleContext();

  const members = useMemo(() => roomData.members ?? [], [roomData.members]);
  const meId = roomData.meMemberId ?? members.find((m) => m.isMe)?.id ?? '';
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const assignable = useMemo(
    () => members.filter((m) => m.id === meId || !m.linked),
    [members, meId],
  );
  const assignableIds = useMemo(() => new Set(assignable.map((m) => m.id)), [assignable]);

  const [overrides, setOverrides] = useState<TRoomOverrides>(() => new Map());
  const [hoursOverrides, setHoursOverrides] = useState<TRoomHours>(() => new Map());
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alternatingOpen, setAlternatingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);

  const serverOwners = useMemo(() => buildOwnerMap(roomData.days), [roomData.days]);
  const serverHours = useMemo(
    () => draftFromWorkDates(scheduleData?.workDates),
    [scheduleData?.workDates],
  );
  const bookingCounts = useMemo(() => buildBookingCounts(scheduleData), [scheduleData]);
  const hasBookingsFlag = useMemo(
    () => new Set((roomData.days ?? []).filter((d) => d.hasBookings).map((d) => d.date)),
    [roomData.days],
  );
  const defaultIntervals = useMemo<TWorkingInterval[]>(
    () =>
      scheduleData?.defaultIntervals?.length
        ? scheduleData.defaultIntervals
        : [{ ...DEFAULT_WORK_INTERVAL }],
    [scheduleData],
  );

  const owners = useMemo(() => {
    const map = new Map(serverOwners);
    for (const [date, id] of overrides) {
      if (id) {
        map.set(date, id);
      } else {
        map.delete(date);
      }
    }
    return map;
  }, [serverOwners, overrides]);

  const dayColors = useMemo(() => {
    const colors = new Map<string, string>();
    for (const [date, id] of owners) {
      const member = memberById.get(id);
      if (member) {
        colors.set(date, roomColorVar(member.color));
      }
    }
    return colors;
  }, [owners, memberById]);

  // Bookings on days the caller owns on the server (a day claimed only in the draft has none).
  const bookingsOn = (date: string): number => {
    if (serverOwners.get(date) !== meId) {
      return 0;
    }
    return Math.max(bookingCounts.get(date) ?? 0, hasBookingsFlag.has(date) ? 1 : 0);
  };
  const markedDates = useMemo(() => {
    const marks = new Set<string>();
    for (const [date, id] of owners) {
      if (id === meId && serverOwners.get(date) === meId) {
        if ((bookingCounts.get(date) ?? 0) > 0 || hasBookingsFlag.has(date)) {
          marks.add(date);
        }
      }
    }
    return marks;
  }, [owners, serverOwners, meId, bookingCounts, hasBookingsFlag]);

  const todayISO = formatDateISO(new Date());
  const assignments = overridesToAssignments(overrides);
  const hoursChanges = useMemo(() => {
    const changes: { date: string; intervals: TWorkingInterval[] | null }[] = [];
    for (const [date, intervals] of hoursOverrides) {
      if (date < todayISO || owners.get(date) !== meId) {
        continue;
      }
      const server = serverOwners.get(date) === meId ? (serverHours.get(date) ?? null) : null;
      if (intervalsKey(server) !== intervalsKey(intervals)) {
        changes.push({ date, intervals });
      }
    }
    return changes.sort((a, b) => a.date.localeCompare(b.date));
  }, [hoursOverrides, owners, meId, serverOwners, serverHours, todayISO]);
  const changeCount = assignments.length + hoursChanges.length;

  const formatShort = (iso: string): string => {
    const date = parseDateParam(iso);
    return date ? `${date.getDate()} ${tdat(`monthsGen.${monthKeys[date.getMonth()]}`)}` : iso;
  };
  /** "ср, 18 ноября": short weekday and date. */
  const formatWithDay = (iso: string): string => {
    const date = parseDateParam(iso);
    if (!date) {
      return iso;
    }
    const weekday = tdat(`daysShort.${dayKeys[date.getDay()]}`);
    return `${locale === 'ru' ? weekday.toLowerCase() : weekday}, ${formatShort(iso)}`;
  };
  const dayTitle = (iso: string | null): string => {
    const date = iso ? parseDateParam(iso) : undefined;
    return date ? `${tdat(`daysFull.${dayKeys[date.getDay()]}`)}, ${formatShort(iso!)}` : '';
  };

  const reportError = (err: unknown): void => {
    console.error('Room calendar request failed:', err);
    if (err instanceof RoomError || err instanceof WorkDatesConflictError) {
      const dates = err.dates.map(formatShort).join(', ');
      const base = err.message || t('roomConflictUnknown');
      toast.error(dates ? `${base}: ${dates}` : base);
      return;
    }
    toast.error(te('saveFailed'));
  };

  const assignDate = (date: string, memberId: string): void => {
    setOverrides((prev) => setOverride(serverOwners, prev, date, memberId));
  };

  const ownerOf = (date: string): string => effectiveOwner(serverOwners, overrides, date);
  const sheetOwner = sheetDate ? ownerOf(sheetDate) : '';
  const sheetOwnerMember = memberById.get(sheetOwner);
  const sheetKind: 'mine' | 'linked' | 'assign' =
    sheetOwner === meId && meId !== '' ? 'mine' : sheetOwnerMember?.linked ? 'linked' : 'assign';

  const handleSelectDate = (date: Date): void => {
    const iso = formatDateISO(date);
    if (iso < todayISO) {
      // Past days are read-only history.
      return;
    }
    setSheetDate(iso);
    setSheetOpen(true);
  };

  const assignOptions = (date: string): TRoomDayOption[] => {
    const current = ownerOf(date);
    const options: TRoomDayOption[] = assignable
      .filter((m) => m.id !== current)
      .map((m) => ({
        memberId: m.id,
        label: m.id === meId ? tr('you') : m.name,
        color: m.color,
      }));
    if (current !== '') {
      options.push({ memberId: '', label: t('roomFree') });
    }
    return options;
  };

  const outgoingFor = (date: string | null): { id: string } | undefined =>
    roomData.requests?.outgoing.find((r) => r.date.slice(0, 10) === date);

  const handleRequestDay = async (): Promise<void> => {
    if (!sheetDate) {
      return;
    }
    setRequestBusy(true);
    try {
      await api.admin.createRoomRequest(sheetDate);
      await invalidateRoom();
      toast.success(t('requestSentToast'));
      setSheetOpen(false);
    } catch (err) {
      reportError(err);
    } finally {
      setRequestBusy(false);
    }
  };

  const handleCancelRequest = async (): Promise<void> => {
    const request = outgoingFor(sheetDate);
    if (!request) {
      return;
    }
    setRequestBusy(true);
    try {
      await api.admin.cancelRoomRequest(request.id);
      await invalidateRoom();
      setSheetOpen(false);
    } catch (err) {
      reportError(err);
    } finally {
      setRequestBusy(false);
    }
  };

  const handleIncoming = async (id: string, accept: boolean): Promise<void> => {
    setRequestBusy(true);
    try {
      if (accept) {
        await api.admin.acceptRoomRequest(id);
      } else {
        await api.admin.declineRoomRequest(id);
      }
      await invalidateRoom();
      toast.success(accept ? t('requestAccepted') : t('requestDeclined'));
    } catch (err) {
      if (accept && err instanceof RoomError && err.status === 409) {
        toast.error(t('acceptNeedsMove'));
      } else {
        reportError(err);
      }
    } finally {
      setRequestBusy(false);
    }
  };

  const handleRepeatLastWeek = (): void => {
    const plan = planRoomRepeatLastWeek(owners, assignableIds, new Date());
    if (!plan || plan.additions.length === 0) {
      toast(t('nothingToRepeat'));
      return;
    }
    setOverrides((prev) => {
      let next = prev;
      for (const [date, memberId] of plan.additions) {
        next = setOverride(serverOwners, next, date, memberId);
      }
      return next;
    });
    const target = parseDateParam(plan.targetWeek);
    if (target) {
      setDisplayMonth(target);
    }
    toast.success(t('repeated', { count: plan.additions.length }));
  };

  const handleFillAlternating = (params: TRoomAlternatingParams): void => {
    const plan = planRoomAlternatingWeeks(
      owners,
      assignable.map((m) => m.id),
      new Date(),
      params,
    );
    if (plan.length === 0) {
      toast(t('nothingToFill'));
      return;
    }
    setOverrides((prev) => {
      let next = prev;
      for (const [date, memberId] of plan) {
        next = setOverride(serverOwners, next, date, memberId);
      }
      return next;
    });
    toast.success(t('filled', { count: plan.length }));
  };

  const handleCopySchedule = async (): Promise<void> => {
    const today = new Date();
    const lines = buildScheduleLines(owners, members, today, COPY_DAYS, (m) =>
      tdat(`monthsShort.${monthKeys[m]}`),
    );
    if (lines.length === 0) {
      toast(t('copyNothing'));
      return;
    }
    const months = scheduleMonthSpan(today, COPY_DAYS, (m) =>
      tdat(`monthsNom.${monthKeys[m]}`).toLowerCase(),
    );
    const roomName = roomData.room?.name ?? '';
    const header = roomName
      ? t('copyHeader', { name: roomName, months })
      : t('copyHeaderNoName', { months });
    if (await copyText([header, ...lines].join('\n'))) {
      toast.success(t('copied'));
    } else {
      toast.error(tr('copyFailed'));
    }
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    const pendingHours = hoursChanges;
    let assignmentsSaved = false;
    try {
      if (assignments.length > 0) {
        await api.admin.updateRoomDays(assignments);
        assignmentsSaved = true;
        setOverrides(new Map());
        await invalidateRoom();
      }
      if (pendingHours.length > 0) {
        await api.admin.updateWorkDates({ open: pendingHours, close: [] });
        setHoursOverrides(new Map());
        await invalidateWorkDates();
      }
      setOverrides(new Map());
      setHoursOverrides(new Map());
      toast.success(ts('saved'));
    } catch (err) {
      if (assignmentsSaved && pendingHours.length > 0) {
        // Step one went through (the assignments are no longer in the draft); only the hours
        // are left, so a second Save sends just them.
        console.error('Failed to save hours after assignments:', err);
        toast.error(t('partialSave'));
      } else {
        reportError(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const mineHours = (date: string | null): TWorkingInterval[] | null => {
    if (!date) {
      return null;
    }
    if (hoursOverrides.has(date)) {
      return hoursOverrides.get(date) ?? null;
    }
    return serverOwners.get(date) === meId ? (serverHours.get(date) ?? null) : null;
  };

  const incoming = roomData.requests?.incoming ?? [];
  const bookingsHref = sheetDate
    ? `${resolveTestAwareHref(pathname, '/admin/bookings')}?dateFrom=${sheetDate}&dateTo=${sheetDate}`
    : resolveTestAwareHref(pathname, '/admin/bookings');
  const sheetBookings = sheetDate ? bookingsOn(sheetDate) : 0;

  return (
    <div className={changeCount > 0 ? 'pb-28' : 'pb-6'} data-testid={'room-work-days'}>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-4 p-4'}>
        <div className={'flex items-center justify-between gap-3'}>
          <p className={'text-muted-foreground min-w-0 flex-1 text-sm'}>{t('roomHint')}</p>
          <Link
            href={resolveTestAwareHref(pathname, '/admin/settings/room')}
            className={'text-brand shrink-0 text-sm font-medium'}
          >
            {t('roomMembersLink')}
          </Link>
        </div>

        {/***************************************************************************************************
         * Incoming requests for my days.
         ***************************************************************************************************/}
        {incoming.length > 0 && (
          <div className={'space-y-2'} data-testid={'room-incoming-requests'}>
            {incoming.map((request) => (
              <div key={request.id} className={'bg-card space-y-2 rounded-xl p-3'}>
                <p className={'text-foreground text-sm'}>
                  {t('incomingRequest', {
                    name: memberById.get(request.fromMemberId)?.name ?? '',
                    date: formatWithDay(request.date.slice(0, 10)),
                  })}
                </p>
                <div className={'flex gap-2'}>
                  <button
                    type={'button'}
                    disabled={requestBusy}
                    onClick={() => {
                      void handleIncoming(request.id, true);
                    }}
                    className={
                      'bg-brand flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-40'
                    }
                  >
                    {t('giveAway')}
                  </button>
                  <button
                    type={'button'}
                    disabled={requestBusy}
                    onClick={() => {
                      void handleIncoming(request.id, false);
                    }}
                    className={
                      'bg-background text-foreground flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40'
                    }
                  >
                    {t('refuse')}
                  </button>
                </div>
              </div>
            ))}
          </div>
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
        <button
          type={'button'}
          onClick={() => {
            void handleCopySchedule();
          }}
          className={
            'bg-card text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium active:opacity-70'
          }
        >
          <Copy className={'h-4 w-4 shrink-0'} />
          <span>{t('copySchedule')}</span>
        </button>

        <MonthGrid
          displayDate={displayMonth}
          selectedDate={null}
          onSelectDate={handleSelectDate}
          onPrevMonth={() =>
            setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))
          }
          onNextMonth={() =>
            setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
          }
          dayColors={dayColors}
          markedDates={markedDates}
          disablePast
          disableNonWorking={false}
          card
          onTitleClick={() => setDisplayMonth(new Date())}
        />

        {/***************************************************************************************************
         * Legend: one dot per member, plus "free".
         ***************************************************************************************************/}
        <div
          data-testid={'room-legend'}
          className={
            'text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs'
          }
        >
          {members.map((member) => (
            <div key={member.id} className={'flex items-center gap-1.5'}>
              <span
                className={'h-3 w-3 rounded-full'}
                style={{ backgroundColor: roomColorVar(member.color) }}
              />
              <span>{member.id === meId ? tr('you') : member.name}</span>
            </div>
          ))}
          <div className={'flex items-center gap-1.5'}>
            <span className={'border-border h-3 w-3 rounded-full border'} />
            <span>{t('roomFree')}</span>
          </div>
          <div className={'flex items-center gap-1.5'}>
            <span className={'bg-brand h-1.5 w-1.5 rounded-full'} />
            <span>{t('legendBookings')}</span>
          </div>
        </div>
      </div>

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
            onClick={() => {
              setOverrides(new Map());
              setHoursOverrides(new Map());
            }}
            disabled={saving}
            className={'text-muted-foreground px-2 py-2 text-sm font-medium disabled:opacity-40'}
          >
            {t('reset')}
          </button>
          <div className={'w-32'}>
            <PrimaryButton
              onClick={() => {
                void handleSave();
              }}
              disabled={saving}
            >
              {saving ? tc('saving') : tc('save')}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/***************************************************************************************************
       * Day sheets: my day -> hours editor + free/give away; free or offline day -> choose owner;
       * linked colleague's day -> request it.
       ***************************************************************************************************/}
      <WorkDaySheet
        isOpen={sheetOpen && sheetKind === 'mine'}
        onClose={() => setSheetOpen(false)}
        title={dayTitle(sheetDate)}
        intervals={mineHours(sheetDate)}
        defaultIntervals={defaultIntervals}
        bookingsCount={sheetBookings}
        bookingsHref={bookingsHref}
        closeLabel={t('freeDay')}
        onSetHours={(intervals) => {
          if (sheetDate) {
            setHoursOverrides((prev) => new Map(prev).set(sheetDate, intervals));
          }
        }}
        onCloseDay={() => {
          if (sheetDate) {
            assignDate(sheetDate, '');
          }
          setSheetOpen(false);
        }}
      >
        {assignable
          .filter((m) => m.id !== meId)
          .map((member) => (
            <button
              key={member.id}
              type={'button'}
              data-testid={`give-to-${member.id}`}
              disabled={sheetBookings > 0}
              onClick={() => {
                if (sheetDate) {
                  assignDate(sheetDate, member.id);
                }
                setSheetOpen(false);
              }}
              className={
                'bg-background text-foreground flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40'
              }
            >
              <span
                className={'h-3.5 w-3.5 rounded-full'}
                style={{ backgroundColor: roomColorVar(member.color) }}
              />
              {t('giveTo', { name: member.name })}
            </button>
          ))}
      </WorkDaySheet>

      <RoomDaySheet
        isOpen={sheetOpen && sheetKind === 'assign'}
        onClose={() => setSheetOpen(false)}
        mode={'assign'}
        title={
          sheetOwnerMember
            ? t('roomDayOf', {
                name: sheetOwnerMember.name,
                date: sheetDate ? formatWithDay(sheetDate) : '',
              })
            : t('whoWorks', { date: sheetDate ? formatWithDay(sheetDate) : '' })
        }
        options={sheetDate ? assignOptions(sheetDate) : []}
        onPick={(memberId) => {
          if (sheetDate) {
            assignDate(sheetDate, memberId);
          }
          setSheetOpen(false);
        }}
      />

      <RoomDaySheet
        isOpen={sheetOpen && sheetKind === 'linked'}
        onClose={() => setSheetOpen(false)}
        mode={'linked'}
        title={t('roomDayOf', {
          name: sheetOwnerMember?.name ?? '',
          date: sheetDate ? formatWithDay(sheetDate) : '',
        })}
        requested={outgoingFor(sheetDate) !== undefined}
        requestBusy={requestBusy}
        onRequest={() => {
          void handleRequestDay();
        }}
        onCancelRequest={() => {
          void handleCancelRequest();
        }}
      />

      <AlternatingWeeksSheet
        isOpen={alternatingOpen}
        onClose={() => setAlternatingOpen(false)}
        onFill={() => undefined}
        members={assignable.map((m) => ({
          id: m.id,
          label: m.id === meId ? tr('you') : m.name,
          color: m.color,
        }))}
        onFillRoom={handleFillAlternating}
      />
    </div>
  );
}
