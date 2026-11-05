import { Send } from 'lucide-react';

import { MASTER_BOT_URL } from '@/lib/site';

import type { ReactNode } from 'react';

type TCtaButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  icon?: boolean;
  wrap?: boolean;
  href?: string;
  className?: string;
};

const VARIANTS: Record<NonNullable<TCtaButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_10px_28px_-12px_var(--primary)] hover:bg-brand-hover hover:shadow-[0_14px_32px_-12px_var(--primary)]',
  secondary: 'surface text-foreground hover:bg-surface-hover',
  inverse: 'bg-background text-foreground shadow-[0_10px_28px_-14px_rgb(0_0_0/0.5)] hover:bg-card',
};

const SIZES: Record<NonNullable<TCtaButtonProps['size']>, string> = {
  sm: 'min-h-11 px-5 text-sm',
  md: 'min-h-12 px-6 text-[0.9375rem]',
  lg: 'min-h-14 px-8 text-base',
};

export function CtaButton({
  children,
  variant = 'primary',
  size = 'md',
  icon = true,
  wrap = false,
  href = MASTER_BOT_URL,
  className = '',
}: TCtaButtonProps): ReactNode {
  return (
    <a
      href={href}
      target={'_blank'}
      rel={'noopener noreferrer'}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full text-center leading-tight font-semibold ${wrap ? '' : 'whitespace-nowrap'} transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98] ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {icon ? <Send aria-hidden={'true'} className={'size-[1.05em] shrink-0'} /> : null}
      <span>{children}</span>
    </a>
  );
}
