import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  aspect: 'avatar' | 'banner';
  uploading: boolean;
  progress: number;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  open,
  file,
  aspect,
  uploading,
  progress,
  onCancel,
  onConfirm,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleSave() {
    const img = imgRef.current;
    if (!img) return;

    const outW = aspect === 'avatar' ? 512 : 1200;
    const outH = aspect === 'avatar' ? 512 : 400;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight) * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const dx = (outW - drawW) / 2 + (offsetX / 100) * (drawW - outW) * 0.5;
    const dy = (outH - drawH) / 2 + (offsetY / 100) * (drawH - outH) * 0.5;

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, dx, dy, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      'image/webp',
      0.88
    );
  }

  return (
    <Modal
      open={open}
      onClose={uploading ? () => {} : onCancel}
      title={aspect === 'avatar' ? 'Crop profile picture' : 'Crop profile banner'}
      description="Adjust zoom and framing before saving to your profile."
    >
      <div className="space-y-5">
        <div
          className={`relative mx-auto overflow-hidden border border-cbox-border bg-cbox-bg ${
            aspect === 'avatar' ? 'h-56 w-56 rounded-full' : 'h-40 w-full rounded-xl'
          }`}
        >
          {previewUrl && (
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Crop preview"
              style={{
                transform: `scale(${zoom}) translate(${offsetX * 0.25}%, ${offsetY * 0.25}%)`,
              }}
              className="h-full w-full object-cover transition-transform duration-75 select-none"
            />
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-cbox-muted">
            <ZoomOut className="h-4 w-4 shrink-0" />
            <input
              type="range"
              min={1}
              max={2.4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-cbox-accent"
            />
            <ZoomIn className="h-4 w-4 shrink-0" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-cbox-muted space-y-1">
              <span>Horizontal shift</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={offsetX}
                onChange={(e) => setOffsetX(Number(e.target.value))}
                className="w-full accent-cbox-accent"
              />
            </label>
            <label className="text-xs text-cbox-muted space-y-1">
              <span>Vertical shift</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={offsetY}
                onChange={(e) => setOffsetY(Number(e.target.value))}
                className="w-full accent-cbox-accent"
              />
            </label>
          </div>
        </div>

        {uploading && (
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-cbox-elevated overflow-hidden">
              <div
                className="h-full bg-cbox-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-cbox-muted text-right">Uploading… {progress}%</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={uploading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-cbox-border text-cbox-text hover:bg-cbox-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover disabled:opacity-50"
          >
            {uploading ? 'Saving…' : 'Save image'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
