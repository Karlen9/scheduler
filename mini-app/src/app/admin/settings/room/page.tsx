'use client';

import { CalendarCheck, ChevronRight, Clock, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsGroup, SettingsMenuItem } from '@/components/SettingsMenuItem';
import { TopBar } from '@/components/TopBar';
import { invalidateRoom } from '@/hooks/mutations';
import { useAdminRoom, useAdminScheduleContext } from '@/hooks/queries';
import { api } from '@/lib/api';
import { RoomError } from '@/lib/api-error';
import { DEFAULT_WORK_INTERVAL } from '@/lib/intervals';
import { MAX_ROOM_MEMBERS, firstUnusedColor, roomColorVar } from '@/lib/room';
import { resolveTestAwareHref } from '@/lib/routes';
import { isDatesMode } from '@/lib/work-calendar';

import { AddMemberSheet } from './AddMemberSheet';
import { InviteSheet } from './InviteSheet';
import { MemberSheet } from './MemberSheet';

import type { TRoomMember } from '@/lib/types';
import type { ReactNode } from 'react';

type TConfirmTarget = { kind: 'remove'; member: TRoomMember } | { kind: 'leave' } | null;

/***************************************************************************************************
 * Settings -> shared room ("Кабинет"): create a room, manage its members (offline colleagues the
 * specialist maintains themself, and linked colleagues with their own bot), invite colleagues by
 * link and leave the room.
 ***************************************************************************************************/
export default function RoomPage(): ReactNode {
  const t = useTranslations('AdminRoom');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');

  const pathname = usePathname();
  const { data, isLoading } = useAdminRoom();
  const { data: scheduleData } = useAdminScheduleContext();
  const [justCreated, setJustCreated] = useState(false);
  const defaultHours = (
    scheduleData?.defaultIntervals?.length
      ? scheduleData.defaultIntervals
      : [{ ...DEFAULT_WORK_INTERVAL }]
  )
    .map((i) => `${i.startTime}–${i.endTime}`)
    .join(', ');
  const room = data.room;
  const members = data.members ?? [];
  const isCreator = room?.isCreator ?? false;

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSheetId, setMemberSheetId] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ link: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<TConfirmTarget>(null);

  const memberSheet = members.find((m) => m.id === memberSheetId) ?? null;

  const reportError = (err: unknown): void => {
    console.error('Room request failed:', err);
    toast.error(err instanceof RoomError && err.message ? err.message : te('saveFailed'));
  };

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setSaving(true);
    try {
      await action();
      await invalidateRoom();
      return true;
    } catch (err) {
      reportError(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    try {
      await api.admin.createRoom(newName.trim());
      await invalidateRoom();
      setNewName('');
      setJustCreated(true);
      toast.success(t('created'));
    } catch (err) {
      reportError(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (): Promise<void> => {
    const ok = await run(async () => {
      await api.admin.updateRoom(nameDraft.trim());
    });
    if (ok) {
      setEditingName(false);
    }
  };

  const handleAddMember = async (params: {
    name: string;
    color: string;
    invite: boolean;
  }): Promise<void> => {
    let link: string | undefined;
    const ok = await run(async () => {
      const result = await api.admin.addRoomMember(params);
      link = result.inviteLink;
    });
    if (!ok) {
      return;
    }
    setAddOpen(false);
    if (params.invite && link) {
      setInvite({ link, name: params.name });
    }
  };

  const handleSaveMember = async (
    id: string,
    changes: { name?: string; color?: string },
  ): Promise<void> => {
    const ok = await run(async () => {
      await api.admin.updateRoomMember(id, changes);
    });
    if (ok) {
      setMemberSheetId(null);
    }
  };

  const handleInviteMember = async (member: TRoomMember): Promise<void> => {
    let link: string | undefined;
    const ok = await run(async () => {
      link = (await api.admin.createRoomMemberInvite(member.id)).inviteLink;
    });
    if (ok && link) {
      setMemberSheetId(null);
      setInvite({ link, name: member.name });
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (!confirm) {
      return;
    }
    const target = confirm;
    const memberId = target.kind === 'leave' ? data.meMemberId : target.member.id;
    if (!memberId) {
      return;
    }
    const ok = await run(async () => {
      await api.admin.deleteRoomMember(memberId);
    });
    if (ok) {
      setMemberSheetId(null);
      if (target.kind === 'leave') {
        toast.success(t('left'));
      }
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

  if (!room) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'space-y-4 p-4'}>
          <p className={'text-muted-foreground text-sm'}>{t('intro')}</p>
          {!isDatesMode(scheduleData) && (
            <p
              data-testid={'room-weekly-note'}
              className={'bg-status-warning-bg text-status-warning-text rounded-xl p-3 text-xs'}
            >
              {t('weeklyNote')}
            </p>
          )}
          <div>
            <label className={'text-muted-foreground mb-1 block text-sm'}>{t('roomName')}</label>
            <input
              type={'text'}
              value={newName}
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('roomNamePlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
          </div>
          <PrimaryButton
            onClick={() => {
              void handleCreate();
            }}
            disabled={creating}
          >
            {creating ? tc('saving') : t('createRoom')}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const confirmMember = confirm?.kind === 'remove' ? confirm.member : null;

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-5 p-4'}>
        {justCreated && (
          <div data-testid={'room-created-banner'} className={'bg-card space-y-3 rounded-xl p-4'}>
            <p className={'text-foreground text-sm'}>{t('createdHint')}</p>
            <Link
              href={resolveTestAwareHref(pathname, '/admin/settings/work-days')}
              className={
                'bg-primary text-primary-foreground block rounded-xl px-6 py-3.5 text-center text-base font-medium active:opacity-80'
              }
            >
              {t('distributeDays')}
            </Link>
          </div>
        )}

        {/***************************************************************************************************
         * Room name.
         ***************************************************************************************************/}
        {editingName ? (
          <div className={'flex items-center gap-2'}>
            <input
              type={'text'}
              value={nameDraft}
              maxLength={80}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={t('roomNamePlaceholder')}
              className={
                'bg-card text-foreground focus:ring-brand min-w-0 flex-1 rounded-lg px-4 py-3 outline-none focus:ring-2'
              }
            />
            <button
              type={'button'}
              disabled={saving}
              onClick={() => {
                void handleRename();
              }}
              className={'bg-brand rounded-lg px-4 py-3 text-sm font-medium text-white'}
            >
              {t('save')}
            </button>
          </div>
        ) : (
          <div className={'flex items-center gap-2'}>
            <h2 className={'text-foreground min-w-0 flex-1 truncate text-lg font-semibold'}>
              {room.name || t('title')}
            </h2>
            <button
              type={'button'}
              aria-label={t('rename')}
              onClick={() => {
                setNameDraft(room.name);
                setEditingName(true);
              }}
              className={'text-muted-foreground p-2'}
            >
              <Pencil className={'h-4 w-4'} />
            </button>
          </div>
        )}

        {/***************************************************************************************************
         * Members.
         ***************************************************************************************************/}
        <div className={'space-y-2'}>
          <h3 className={'text-muted-foreground px-1 text-sm font-medium'}>{t('members')}</h3>
          <div className={'bg-card divide-border divide-y overflow-hidden rounded-xl'}>
            {members.map((member) => (
              <button
                key={member.id}
                type={'button'}
                data-testid={`room-member-${member.id}`}
                onClick={() => setMemberSheetId(member.id)}
                className={
                  'active:bg-surface-hover flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors'
                }
              >
                <span
                  className={'h-3.5 w-3.5 shrink-0 rounded-full'}
                  style={{ backgroundColor: roomColorVar(member.color) }}
                />
                <span className={'text-foreground min-w-0 flex-1 truncate text-[15px]'}>
                  {member.name}
                </span>
                <span className={'text-muted-foreground text-xs'}>
                  {member.isMe
                    ? t('badgeMe')
                    : member.linked
                      ? t('badgeLinked')
                      : t('badgeOffline')}
                </span>
                <ChevronRight className={'text-muted-foreground h-4 w-4 shrink-0'} />
              </button>
            ))}
          </div>

          {members.length < MAX_ROOM_MEMBERS ? (
            <button
              type={'button'}
              onClick={() => setAddOpen(true)}
              className={
                'border-border text-muted-foreground active:bg-card flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition-colors'
              }
            >
              <Plus className={'h-5 w-5'} />
              <span>{t('addMember')}</span>
            </button>
          ) : (
            <p className={'text-muted-foreground px-1 text-xs'}>{t('maxMembers')}</p>
          )}
        </div>

        <SettingsGroup title={t('scheduleSection')}>
          <SettingsMenuItem
            icon={CalendarCheck}
            label={t('workDays')}
            subtitle={t('workDaysSubtitle')}
            href={'/admin/settings/work-days'}
            iconColor={'bg-success'}
          />
          <SettingsMenuItem
            icon={Clock}
            label={t('defaultHours')}
            subtitle={defaultHours}
            href={'/admin/settings/schedule'}
            iconColor={'bg-warning'}
          />
        </SettingsGroup>

        <button
          type={'button'}
          onClick={() => setConfirm({ kind: 'leave' })}
          className={
            'text-destructive bg-destructive/10 w-full rounded-xl px-4 py-3 text-sm font-medium active:opacity-70'
          }
        >
          {t('leaveRoom')}
        </button>
      </div>

      <AddMemberSheet
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        defaultColor={firstUnusedColor(members)}
        saving={saving}
        onSubmit={(params) => {
          void handleAddMember(params);
        }}
      />

      <MemberSheet
        member={memberSheet}
        isCreator={isCreator}
        saving={saving}
        onClose={() => setMemberSheetId(null)}
        onSave={(id, changes) => {
          void handleSaveMember(id, changes);
        }}
        onInvite={(member) => {
          void handleInviteMember(member);
        }}
        onRemove={(member) => setConfirm({ kind: 'remove', member })}
      />

      <InviteSheet
        link={invite?.link ?? null}
        memberName={invite?.name ?? ''}
        onClose={() => setInvite(null)}
      />

      <ConfirmDialog
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          void handleConfirm();
        }}
        destructive
        title={
          confirm?.kind === 'leave'
            ? t('leaveTitle')
            : confirmMember?.linked
              ? t('excludeTitle', { name: confirmMember.name })
              : t('deleteTitle', { name: confirmMember?.name ?? '' })
        }
        description={
          confirm?.kind === 'leave'
            ? t('leaveDescription')
            : confirmMember?.linked
              ? t('excludeDescription')
              : t('deleteDescription', { name: confirmMember?.name ?? '' })
        }
        confirmText={
          confirm?.kind === 'leave'
            ? t('leaveConfirm')
            : confirmMember?.linked
              ? t('excludeConfirm')
              : t('deleteConfirm')
        }
      />
    </div>
  );
}
