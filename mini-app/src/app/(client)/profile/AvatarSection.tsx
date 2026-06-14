'use client';

import Image from 'next/image';

import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';

import type { TAvatarSectionProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the avatar section UI and related interactions.
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
export function AvatarSection({
  name,
  photoUrl,
  photoError,
  onPhotoError,
}: TAvatarSectionProps): ReactNode {
  const photoSrc = !photoError ? getPhotoUrl(photoUrl) : null;

  return (
    <div className={'flex justify-center pt-2'}>
      <div className={'relative'}>
        {photoSrc ? (
          <Image
            width={96}
            height={96}
            src={photoSrc}
            alt={name}
            unoptimized
            className={'h-24 w-24 rounded-full object-cover'}
            onError={onPhotoError}
          />
        ) : (
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl ${name ? getAvatarColor(name) : 'bg-card text-muted-foreground'}`}
          >
            {name.charAt(0) || '?'}
          </div>
        )}
      </div>
    </div>
  );
}
