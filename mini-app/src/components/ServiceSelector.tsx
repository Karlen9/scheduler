import { SessionType } from '@/lib/types';

interface ServiceSelectorProps {
  services: SessionType[];
  selectedId: string;
  onChange: (service: SessionType) => void;
}

export function ServiceSelector({ services, selectedId, onChange }: ServiceSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
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
