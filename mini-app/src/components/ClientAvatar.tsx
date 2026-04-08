'use client';

import Image from 'next/image';
import { useState } from 'react';

import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';

import type { TClientAvatarProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Defines the size classes value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-2xl',
};

/***************************************************************************************************
 * Renders the client avatar UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function ClientAvatar({ name, photoUrl, size = 'md' }: TClientAvatarProps): ReactNode {
  const [error, setError] = useState(false);
  /***************************************************************************************************
   * Defines the cls value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const cls = sizeClasses[size];

  /***************************************************************************************************
   * Implements the if logic used by this module.
   *
   * Parameters:
   * - photoUrl && !error: Photo url && !error used by the current operation.
   *
   * Returns:
   * - No direct return value; work is exposed through state updates or side effects.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  if (photoUrl && !error) {
    return (
      <Image
        width={32}
        height={32}
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
