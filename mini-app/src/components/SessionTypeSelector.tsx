interface SessionType {
  id: string;
  label: string;
}

interface SessionTypeSelectorProps {
  options: SessionType[];
  selected: string;
  onChange: (id: string) => void;
}

export function SessionTypeSelector({
  options,
  selected,
  onChange,
}: SessionTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`px-4 py-2 rounded-full text-sm transition-colors ${
            selected === option.id
              ? "bg-[var(--app-primary)] text-[var(--app-primary-text)]"
              : "bg-[var(--app-surface)] text-[var(--app-text)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
