'use client';

import { useTranslations } from 'next-intl';

interface ScheduleTabsProps {
  activeTab: 'day' | 'week';
  onChange: (tab: 'day' | 'week') => void;
}

export function ScheduleTabs({ activeTab, onChange }: ScheduleTabsProps) {
  const t = useTranslations('ScheduleView');

  return (
    <div className="mb-4 flex gap-2">
      <button
        onClick={() => onChange('day')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'day' ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-card'
        }`}
      >
        {t('day')}
      </button>
      <button
        onClick={() => onChange('week')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'week' ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-card'
        }`}
      >
        {t('week')}
      </button>
    </div>
  );
}
