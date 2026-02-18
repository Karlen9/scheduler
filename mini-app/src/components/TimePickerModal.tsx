'use client';

import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/BottomSheet';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  selectedTime?: string;
  title?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export function TimePickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedTime,
  title,
}: TimePickerModalProps) {
  const t = useTranslations('TimePickerModal');
  const resolvedTitle = title ?? t('title');

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      className="max-h-[80vh] overflow-auto"
    >
      <div className="grid grid-cols-4 gap-2">
        {HOURS.map((time) => (
          <button
            key={time}
            onClick={() => {
              onSelect(time);
              onClose();
            }}
            className={`rounded-lg py-3 text-sm transition-colors ${
              selectedTime === time
                ? 'bg-brand text-white'
                : 'bg-card text-foreground active:bg-border'
            }`}
          >
            {time}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
