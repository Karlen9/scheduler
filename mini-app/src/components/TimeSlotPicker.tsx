'use client';

import { useTranslations } from 'next-intl';

interface TimeSlotPickerProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

interface TimeSlot {
  time: string;
  status: 'free' | 'taken';
}

// Mock data - in a real app, this would come from the backend
const timeSlots: TimeSlot[] = [
  { time: '9:00', status: 'taken' },
  { time: '10:00', status: 'taken' },
  { time: '11:00', status: 'free' },
  { time: '12:00', status: 'free' },
  { time: '13:00', status: 'free' },
  { time: '14:00', status: 'free' },
  { time: '15:00', status: 'free' },
  { time: '16:00', status: 'free' },
  { time: '17:00', status: 'free' },
  { time: '18:00', status: 'taken' },
  { time: '19:00', status: 'free' },
  { time: '20:00', status: 'taken' },
  { time: '21:00', status: 'free' },
  { time: '22:00', status: 'free' },
  { time: '23:00', status: 'free' },
];

export function TimeSlotPicker({ selectedTime, onSelectTime }: TimeSlotPickerProps) {
  const t = useTranslations('BookingForm');

  const getSlotClassName = (slot: TimeSlot) => {
    const isSelected = selectedTime === slot.time;

    if (slot.status === 'taken') {
      return 'bg-surface-hover border border-surface-border text-muted-foreground cursor-not-allowed';
    }

    if (isSelected) {
      return 'bg-brand border-2 border-brand text-white';
    }

    return 'bg-card border border-surface-border text-foreground';
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status === 'taken') return;
    onSelectTime(slot.time);
  };

  return (
    <div className="bg-card rounded-[10px] p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground font-['Inter'] text-base font-semibold">
          {t('selectTime')}
        </h3>
        <p className="text-muted-foreground font-['Inter'] text-xs font-medium">
          {/* Working hours info */}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="bg-card border-surface-border h-[22px] w-[21px] rounded-full border" />
          <span className="text-muted-foreground font-['Inter'] text-sm font-medium">
            {t('available')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-surface-hover border-surface-border h-[22px] w-[21px] rounded-full border" />
          <span className="text-muted-foreground font-['Inter'] text-sm font-medium">
            {t('occupied')}
          </span>
        </div>
      </div>

      {/* Time Slots Grid */}
      <div className="grid grid-cols-4 gap-2">
        {timeSlots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => handleSlotClick(slot)}
            disabled={slot.status === 'taken'}
            className={`h-[43px] rounded-[70px] font-['Inter'] text-base font-medium transition-all active:scale-95 ${getSlotClassName(slot)} `}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}
