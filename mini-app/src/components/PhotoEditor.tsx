"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { RotateCw, RotateCcw, X, Check } from "lucide-react";

interface PhotoEditorProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export function PhotoEditor({ imageSrc, onConfirm, onCancel }: PhotoEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
    if (blob) onConfirm(blob);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden" style={{ touchAction: "none" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onCancel} className="p-2 -m-2 text-muted-foreground">
          <X className="w-6 h-6" />
        </button>
        <span className="text-sm font-medium">Редактирование фото</span>
        <button onClick={handleConfirm} className="p-2 -m-2 text-brand">
          <Check className="w-6 h-6" />
        </button>
      </div>

      {/* Crop area */}
      <div className="relative flex-1 overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          cropShape="round"
          showGrid={false}
          restrictPosition={true}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Controls */}
      <div className="px-4 py-4 space-y-4 border-t border-border bg-background">
        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-14">Масштаб</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand"
          />
        </div>

        {/* Rotation buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setRotation((r) => r - 90)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card text-sm text-foreground active:opacity-70"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRotation(0)}
            className="px-4 py-2.5 rounded-lg bg-card text-sm text-muted-foreground active:opacity-70"
          >
            {rotation !== 0 ? `${rotation}°` : "0°"}
          </button>
          <button
            onClick={() => setRotation((r) => r + 90)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card text-sm text-foreground active:opacity-70"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Canvas-based crop + rotation
async function getCroppedImg(
  imageSrc: string,
  crop: Area,
  rotation: number,
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

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
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      0.92,
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = url;
  });
}
