import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

type TPrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: TVoidFunction;
  disabled?: boolean;
  fullWidth?: boolean;
};

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = true,
}: TPrimaryButtonProps): ReactNode {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-6 py-3.5 text-base font-medium transition-opacity ${
        fullWidth ? 'w-full' : ''
      } ${
        disabled
          ? 'bg-primary text-primary-foreground cursor-not-allowed opacity-40'
          : 'bg-primary text-primary-foreground active:opacity-80'
      }`}
    >
      {children}
    </button>
  );
}
