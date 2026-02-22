'use client';

import { Check, RotateCcw, RotateCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';

import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';
import type { Area } from 'react-easy-crop';

type TPhotoEditorProps = {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: TVoidFunction;
};

export function PhotoEditor({ imageSrc, onConfirm, onCancel }: TPhotoEditorProps): ReactNode {
  const t = useTranslations('PhotoEditor');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async (): Promise<void> => {
    if (!croppedAreaPixels) {
      return;
    }
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
    if (blob) {
      onConfirm(blob);
    }
  };

  return (
    <div
      className={'bg-background fixed inset-0 z-60 flex flex-col overflow-hidden'}
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <div className={'border-border flex items-center justify-between border-b px-4 py-3'}>
        <button onClick={onCancel} className={'text-muted-foreground -m-2 p-2'}>
          <X className={'h-6 w-6'} />
        </button>
        <span className={'text-sm font-medium'}>{t('title')}</span>
        <button onClick={handleConfirm} className={'text-brand -m-2 p-2'}>
          <Check className={'h-6 w-6'} />
        </button>
      </div>

      {/* Crop area */}
      <div className={'relative flex-1 overflow-hidden'}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape={'round'}
          showGrid={false}
          restrictPosition={true}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Controls */}
      <div className={'border-border bg-background space-y-4 border-t px-4 py-4'}>
        {/* Zoom slider */}
        <div className={'flex items-center gap-3'}>
          <span className={'text-muted-foreground w-14 text-xs'}>{t('zoom')}</span>
          <input
            type={'range'}
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={'accent-brand flex-1'}
          />
        </div>

        {/* Rotation buttons */}
        <div className={'flex items-center justify-center gap-4'}>
          <button
            onClick={() => setRotation((r) => r - 90)}
            className={
              'bg-card text-foreground flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm active:opacity-70'
            }
          >
            <RotateCcw className={'h-4 w-4'} />
          </button>
          <button
            onClick={() => setRotation(0)}
            className={
              'bg-card text-muted-foreground rounded-lg px-4 py-2.5 text-sm active:opacity-70'
            }
          >
            {rotation !== 0 ? `${rotation}°` : '0°'}
          </button>
          <button
            onClick={() => setRotation((r) => r + 90)}
            className={
              'bg-card text-foreground flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm active:opacity-70'
            }
          >
            <RotateCw className={'h-4 w-4'} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Canvas-based crop + rotation
async function getCroppedImg(imageSrc: string, crop: Area, rotation: number): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const radians = (rotation * Math.PI) / 180;

  // Calculate bounding box of rotated image
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = image.width * cos + image.height * sin;
  const rotH = image.width * sin + image.height * cos;

  // Draw rotated image on temp canvas
  canvas.width = rotW;
  canvas.height = rotH;
  ctx.translate(rotW / 2, rotH / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Extract cropped area
  const data = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);
  canvas.width = crop.width;
  canvas.height = crop.height;
  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}
