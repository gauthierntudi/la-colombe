"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { Loader2, ZoomIn } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { getCroppedImageFile } from "@/lib/crop-image";

type ImageCropModalProps = {
  open: boolean;
  imageSrc: string | null;
  aspect?: number;
  cropShape?: "round" | "rect";
  title?: string;
  maxSize?: number;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function ImageCropModal({
  open,
  imageSrc,
  aspect = 1,
  cropShape,
  title = "Recadrer l'image",
  maxSize = 1024,
  loading,
  onClose,
  onConfirm,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedArea(null);
    }
  }, [open, imageSrc]);

  async function handleConfirm() {
    if (!imageSrc || !croppedArea) return;

    setProcessing(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedArea, "image.jpg", maxSize);
      await onConfirm(file);
    } finally {
      setProcessing(false);
    }
  }

  const busy = loading || processing;

  return (
    <Modal
      open={open && !!imageSrc}
      onClose={onClose}
      title={title}
      description="Ajustez le cadrage et le zoom avant l'envoi."
      size="lg"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={busy || !croppedArea}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Envoi...
              </>
            ) : (
              "Valider et envoyer"
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative w-full h-72 sm:h-80 rounded-xl overflow-hidden bg-[#111827]">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape={cropShape ?? (aspect === 1 ? "round" : "rect")}
              showGrid={aspect !== 1}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <ZoomIn size={16} className="text-[var(--muted)] shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Zoom"
          />
        </div>
      </div>
    </Modal>
  );
}
