import type { TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

type TServiceSelectorProps = {
  services: TSessionType[];
  selectedId: string;
  onChange: (service: TSessionType) => void;
};

export function ServiceSelector({
  services,
  selectedId,
  onChange,
}: TServiceSelectorProps): ReactNode {
  return (
    <div className={'flex flex-wrap gap-2'}>
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onChange(service)}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${
            selectedId === service.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground'
          }`}
        >
          {service.name}
        </button>
      ))}
    </div>
  );
}
