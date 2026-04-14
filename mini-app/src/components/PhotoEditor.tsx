'use client';

import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { Check, RotateCcw, RotateCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';

import type { TPhotoEditorProps } from '@/lib/types';
import type { ReactNode } from 'react';
import type { Area } from 'react-easy-crop';

type TPhotoEditorCloseAction = { type: 'cancel' } | { type: 'confirm'; blob: Blob };

/***************************************************************************************************
 * Renders the photo editor UI and related interactions.
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
export function PhotoEditor({ imageSrc, onConfirm, onCancel }: TPhotoEditorProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('PhotoEditor');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const closeActionRef = useRef<TPhotoEditorCloseAction | null>(null);

  /***************************************************************************************************
   * Defines the on crop complete value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  /***************************************************************************************************
   * Handles confirm.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleConfirm = async (): Promise<void> => {
    if (!croppedAreaPixels) {
      return;
    }
    /***************************************************************************************************
     * Defines the blob value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
    if (blob) {
      closeActionRef.current = { type: 'confirm', blob };
      setIsVisible(false);
    }
  };

  const handleCancel = (): void => {
    closeActionRef.current = { type: 'cancel' };
    setIsVisible(false);
  };

  const handleAfterLeave = (): void => {
    const action = closeActionRef.current;
    if (!action) {
      return;
    }
    closeActionRef.current = null;

    if (action.type === 'confirm') {
      onConfirm(action.blob);
      return;
    }

    onCancel();
  };

  return (
    <Transition show={isVisible} appear as={Fragment} afterLeave={handleAfterLeave}>
      <Dialog onClose={handleCancel} className={'relative z-[100]'}>
        <TransitionChild
          as={Fragment}
          enter={'ease-out duration-200'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-150'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black'} aria-hidden={'true'} />
        </TransitionChild>
        <TransitionChild
          as={Fragment}
          enter={'ease-out duration-300'}
          enterFrom={'translate-y-6 opacity-0'}
          enterTo={'translate-y-0 opacity-100'}
          leave={'ease-in duration-200'}
          leaveFrom={'translate-y-0 opacity-100'}
          leaveTo={'translate-y-6 opacity-0'}
        >
          <DialogPanel
            className={'bg-background fixed inset-0 z-[100] flex flex-col overflow-hidden'}
            style={{ touchAction: 'none' }}
          >
            {/***************************************************************************************************
             * Header.
             ***************************************************************************************************/}
            <div className={'border-border flex items-center justify-between border-b px-4 py-3'}>
              <button onClick={handleCancel} className={'text-muted-foreground -m-2 p-2'}>
                <X className={'h-6 w-6'} />
              </button>
              <span className={'text-sm font-medium'}>{t('title')}</span>
              <button onClick={handleConfirm} className={'text-brand -m-2 p-2'}>
                <Check className={'h-6 w-6'} />
              </button>
            </div>

            {/***************************************************************************************************
             * Crop area.
             ***************************************************************************************************/}
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

            {/***************************************************************************************************
             * Controls.
             ***************************************************************************************************/}
            <div className={'border-border bg-background space-y-4 border-t px-4 py-4'}>
              {/***************************************************************************************************
               * Zoom slider.
               ***************************************************************************************************/}
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

              {/***************************************************************************************************
               * Rotation buttons.
               ***************************************************************************************************/}
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
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

/***************************************************************************************************
 * Canvas-based crop + rotation.
 *
 * Parameters:
 * - imageSrc: Image src used by the current operation.
 * - crop: Crop used by the current operation.
 * - rotation: Rotation used by the current operation.
 *
 * Returns:
 * - A promise that resolves with Blob | null.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
async function getCroppedImg(imageSrc: string, crop: Area, rotation: number): Promise<Blob | null> {
  /***************************************************************************************************
   * Defines the image value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const image = await createImage(imageSrc);
  /***************************************************************************************************
   * Defines the canvas value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const canvas = document.createElement('canvas');
  /***************************************************************************************************
   * Defines the ctx value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  /***************************************************************************************************
   * Defines the radians value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const radians = (rotation * Math.PI) / 180;

  /***************************************************************************************************
   * Calculate bounding box of rotated image.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const sin = Math.abs(Math.sin(radians));
  /***************************************************************************************************
   * Defines the cos value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const cos = Math.abs(Math.cos(radians));
  /***************************************************************************************************
   * Defines the rot w value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const rotW = image.width * cos + image.height * sin;
  /***************************************************************************************************
   * Defines the rot h value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const rotH = image.width * sin + image.height * cos;

  /***************************************************************************************************
   * Draw rotated image on temp canvas.
   ***************************************************************************************************/
  canvas.width = rotW;
  canvas.height = rotH;
  ctx.translate(rotW / 2, rotH / 2);
  ctx.rotate(radians);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  /***************************************************************************************************
   * Extract cropped area.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const data = ctx.getImageData(crop.x, crop.y, crop.width, crop.height);
  canvas.width = crop.width;
  canvas.height = crop.height;
  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

/***************************************************************************************************
 * Creates image.
 *
 * Parameters:
 * - url: Url used by the current operation.
 *
 * Returns:
 * - A promise that resolves with HTMLImageElement.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    /***************************************************************************************************
     * Defines the img value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = url;
  });
}
