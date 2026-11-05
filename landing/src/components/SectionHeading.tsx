import type { ReactNode } from 'react';

type TSectionHeadingProps = {
  title: ReactNode;
  subtitle?: string;
  id?: string;
  className?: string;
};

export function SectionHeading({
  title,
  subtitle,
  id,
  className = '',
}: TSectionHeadingProps): ReactNode {
  return (
    <div
      data-fade={''}
      className={`mx-auto mb-10 max-w-2xl text-center sm:mb-12 lg:mb-14 ${className}`}
    >
      <h2
        id={id}
        className={'text-[1.875rem] leading-[1.12] font-extrabold sm:text-4xl lg:text-[2.75rem]'}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={'text-soft mt-4 text-base leading-relaxed sm:text-lg'}>{subtitle}</p>
      ) : null}
    </div>
  );
}
