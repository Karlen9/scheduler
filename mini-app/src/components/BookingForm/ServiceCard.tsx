import { SessionType } from '@/lib/types';
import { Pencil, Clock } from 'lucide-react';
import { useLocale } from 'next-intl';

export function ServiceCard({
  service,
  selected,
  onSelect,
  onEdit,
  minLabel,
}: {
  service: SessionType;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  minLabel: string;
}) {
  const locale = useLocale();

  function formatPrice(price: number, currency: string): string {
    const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(price);
    return `${formatted} ${currency}`;
  }

  return (
    <button
      onClick={selected ? onEdit : onSelect}
      className={`bg-card w-full rounded-xl p-4 text-left transition-all ${
        selected ? 'ring-brand ring-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground text-sm leading-snug font-medium">{service.name}</p>
        {selected && (
          <div className="bg-brand flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white">
            <Pencil className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          {service.durationMinutes} {minLabel}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatPrice(service.price, service.currency)}
        </span>
      </div>
    </button>
  );
}
