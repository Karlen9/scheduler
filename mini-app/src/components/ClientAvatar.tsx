'use client';

import { useState } from 'react';

import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';

import type { ReactNode } from 'react';

type TClientAvatarProps = {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-2xl',
};

export function ClientAvatar({ name, photoUrl, size = 'md' }: TClientAvatarProps): ReactNode {
  const [error, setError] = useState(false);
  const cls = sizeClasses[size];

  if (photoUrl && !error) {
    return (
      <img
        src={getPhotoUrl(photoUrl)}
        alt={name}
        className={`${cls} shrink-0 rounded-full object-cover`}
        onError={() => setError(true)}
      />
    );
  }

  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full font-medium ${getAvatarColor(name)}`}
    >
      {name.charAt(0)}
    </div>
  );
}
