import type { ReactNode } from 'react';

export function accent(chunks: ReactNode): ReactNode {
  return (
    <span className={'font-accent text-primary font-medium tracking-normal italic'}>{chunks}</span>
  );
}

export function marker(chunks: ReactNode): ReactNode {
  return <span className={'marker'}>{chunks}</span>;
}
