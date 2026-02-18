interface SessionType {
  id: string;
  label: string;
}

interface SessionTypeSelectorProps {
  options: SessionType[];
  selected: string;
  onChange: (id: string) => void;
}

export function SessionTypeSelector({ options, selected, onChange }: SessionTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${
            selected === option.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
