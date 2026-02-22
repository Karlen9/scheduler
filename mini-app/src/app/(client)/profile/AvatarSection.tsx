'use client';

import { Camera } from 'lucide-react';
import { getPhotoUrl } from '@/lib/api';
import { getAvatarColor } from '@/lib/colors';

interface AvatarSectionProps {
  name: string;
  photoUrl: string;
  photoError: boolean;
  isUploading: boolean;
  onPhotoError: () => void;
  onClickUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AvatarSection({
  name,
  photoUrl,
  photoError,
  isUploading,
  onPhotoError,
  onClickUpload,
  fileInputRef,
  onFileSelect,
}: AvatarSectionProps) {
  return (
    <div className="flex justify-center pt-2">
      <div className="relative cursor-pointer" onClick={onClickUpload}>
        {photoUrl && !photoError ? (
          <img
            src={getPhotoUrl(photoUrl)}
            alt={name}
            className="h-24 w-24 rounded-full object-cover"
            onError={onPhotoError}
          />
        ) : (
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl ${name ? getAvatarColor(name) : 'bg-card text-muted-foreground'}`}
          >
            {name.charAt(0) || '?'}
          </div>
        )}
        <div className="bg-brand absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full shadow-lg">
          {isUploading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Camera className="h-4 w-4 text-white" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileSelect}
        />
      </div>
    </div>
  );
}
