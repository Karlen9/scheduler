'use client';

import { Camera } from 'lucide-react';
import Image from 'next/image';

import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';

import type { TAvatarSectionProps } from '@/lib/types';
import type { ReactNode } from 'react';

function isDirectPhotoUrl(photoUrl: string): boolean {
  return (
    photoUrl.startsWith('http') || photoUrl.startsWith('data:') || photoUrl.startsWith('blob:')
  );
}

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
  isUploading,
  disabled = false,
  onPhotoError,
  onClickUpload,
  fileInputRef,
  onFileSelect,
}: TAvatarSectionProps): ReactNode {
  const photoSrc = !photoError ? getPhotoUrl(photoUrl) : null;

  return (
    <div className={'flex justify-center pt-2'}>
      <div
        className={`relative ${disabled ? '' : 'cursor-pointer'}`}
        onClick={disabled ? undefined : onClickUpload}
      >
        {photoSrc ? (
          <Image
            width={96}
            height={96}
            src={photoSrc}
            alt={name}
            unoptimized={isDirectPhotoUrl(photoUrl)}
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
        {!disabled && (
          <div
            className={
              'bg-brand absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full shadow-lg'
            }
          >
            {isUploading ? (
              <div
                className={
                  'h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'
                }
              />
            ) : (
              <Camera className={'h-4 w-4 text-white'} />
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type={'file'}
          accept={'image/jpeg,image/png,image/webp'}
          className={'hidden'}
          disabled={disabled}
          onChange={onFileSelect}
        />
      </div>
    </div>
  );
}
