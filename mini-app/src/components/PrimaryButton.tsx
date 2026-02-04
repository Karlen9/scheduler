interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = true,
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-3.5 px-6 rounded-xl font-medium text-base transition-opacity ${
        fullWidth ? "w-full" : ""
      } ${
        disabled
          ? "bg-[var(--app-primary)] text-[var(--app-primary-text)] opacity-40 cursor-not-allowed"
          : "bg-[var(--app-primary)] text-[var(--app-primary-text)] active:opacity-80"
      }`}
    >
      {children}
    </button>
  );
}
