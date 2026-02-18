'use client';

import { useState } from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { TopBar } from '@/components/TopBar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { MonthCalendar } from '@/components/MonthCalendar';
import { api } from '@/lib/api';
import { useAdminDaysOff } from '@/hooks/queries';
import { invalidateDaysOff } from '@/hooks/mutations';

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

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Parse "YYYY-MM-DD" as local midnight (avoids UTC timezone shift) */
const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function DaysOffPage() {
  const t = useTranslations('AdminDaysOff');
  const tc = useTranslations('Common');
  const tdat = useTranslations('Dates');
  const te = useTranslations('Errors');

  const formatDate = (date: Date): string => {
    const dayName = tdat(`daysShort.${dayKeys[date.getDay()]}`);
    const monthName = tdat(`monthsGen.${monthGenKeys[date.getMonth()]}`);
    return `${dayName}, ${date.getDate()} ${monthName}`;
  };

  const { data: daysOff, isLoading, mutate } = useAdminDaysOff();
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reason, setReason] = useState('');

  const handleAddDayOff = async () => {
    const dateStr = formatDateISO(selectedDate);

    // Check if already exists
    const exists = daysOff.some((d) => d.date.startsWith(dateStr));
    if (exists) return;

    setSaving(true);

    try {
      await api.admin.createDayOff(dateStr, reason || undefined);
      await mutate();
      invalidateDaysOff();
      setShowCalendar(false);
      setReason('');
    } catch (err) {
      console.error('Failed to add day off:', err);
      toast.error(err instanceof Error ? err.message : te('addDayOffFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDayOff = async (id: string) => {
    // Optimistic local update
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
      // Rollback on error
      mutate(previousDaysOff, false);
    }
  };

  const isDayOff = (date: Date) => {
    const dateStr = formatDateISO(date);
    return daysOff.some((d) => d.date.startsWith(dateStr));
  };

  // Convert ISO dates to local Date objects for calendar display
  const daysOffDates = daysOff.map((d) => parseLocalDate(d.date));

  if (isLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className="flex min-h-[200px] items-center justify-center p-4">
          <div className="text-muted-foreground">{tc('loading')}</div>
        </div>
      </div>
    );
  }

  if (showCalendar) {
    return (
      <div>
        <TopBar title={t('selectDate')} showBack onBack={() => setShowCalendar(false)} />

        <div className="space-y-4 p-4">
          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            daysOff={daysOffDates}
          />

          <div>
            <label className="text-muted-foreground mb-1 block text-sm">{t('reasonLabel')}</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="bg-card text-foreground focus:ring-brand w-full rounded-lg px-4 py-3 outline-none focus:ring-2"
            />
          </div>

          <PrimaryButton onClick={handleAddDayOff} disabled={isDayOff(selectedDate) || saving}>
            {saving ? tc('saving') : isDayOff(selectedDate) ? t('alreadyDayOff') : t('addDayOff')}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className="space-y-4 p-4">
        {/* Add Button */}
        <button
          onClick={() => setShowCalendar(true)}
          className="border-border text-muted-foreground active:bg-card flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>{t('addDayOff')}</span>
        </button>

        {/* Days Off List */}
        {daysOff.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Calendar className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>{t('empty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {daysOff.map((dayOff) => (
              <div key={dayOff.id} className="bg-card flex items-center gap-3 rounded-xl p-4">
                <div className="bg-dayoff-bg flex h-10 w-10 items-center justify-center rounded-full">
                  <Calendar className="text-dayoff-text h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-foreground font-medium">
                    {formatDate(parseLocalDate(dayOff.date))}
                  </p>
                  {dayOff.reason && (
                    <p className="text-muted-foreground text-sm">{dayOff.reason}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveDayOff(dayOff.id)}
                  className="text-muted-foreground hover:bg-card flex h-8 w-8 items-center justify-center rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
