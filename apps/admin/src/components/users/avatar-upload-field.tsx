"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { getToken, AuthUser } from "@/lib/client-api";
import { submitToast } from "@/lib/toast";
import { UserAvatar } from "@/components/users/user-avatar";
import { ImageCropModal } from "@/components/ui/image-crop-modal";

type AvatarUploadFieldProps = {
  value: string;
  name: string;
  onChange: (url: string, user?: AuthUser) => void;
  userId?: string;
  persist?: boolean;
  disabled?: boolean;
  centered?: boolean;
};

export function AvatarUploadField({
  value,
  name,
  onChange,
  userId,
  persist = true,
  disabled,
  centered = false,
}: AvatarUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function setPreviewFromFile(file: File) {
    const preview = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
  }

  function clearLocalPreview() {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function openCrop(file: File) {
    setError("");
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    openCrop(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadFile(file: File) {
    setPreviewFromFile(file);
    setUploading(true);
    setError("");

    try {
      const data = await submitToast(
        (async () => {
          const body = new FormData();
          body.append("file", file);
          if (userId) body.append("userId", userId);
          if (!persist) body.append("persist", "false");

          const token = getToken();
          const res = await fetch("/api/v1/upload/avatar", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body,
          });

          const json = await res.json();
          if (!res.ok) {
            throw new Error(json.error?.message ?? "Échec du téléversement");
          }
          return json as { url: string; user?: AuthUser };
        })(),
        {
          pending: "Envoi de la photo...",
          success: "Photo téléversée",
        }
      );

      onChange(data.url, data.user);
      clearLocalPreview();
      closeCrop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    clearLocalPreview();
    onChange("");
  }

  const displaySrc = localPreview || value || null;

  return (
    <>
      <div
        className={
          centered
            ? "flex flex-col items-center gap-4"
            : "flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6"
        }
      >
        <div className="relative">
          <UserAvatar src={displaySrc} name={name || "?"} size="xl" />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 size={22} className="text-white animate-spin" />
            </div>
          )}
        </div>

        <div
          className={
            centered
              ? "flex flex-col items-center gap-2 w-full"
              : "flex flex-col gap-2 w-full sm:w-auto"
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <ImagePlus size={14} />
                {value ? "Changer la photo" : "Ajouter une photo"}
              </>
            )}
          </button>
          {(value || localPreview) && (
            <button
              type="button"
              className="btn btn-ghost text-sm text-[var(--danger)]"
              onClick={handleRemove}
              disabled={disabled || uploading}
            >
              <X size={14} />
              Retirer la photo
            </button>
          )}
          <p className={`text-xs text-[var(--muted)] ${centered ? "text-center" : ""}`}>
            JPEG, PNG, WebP ou GIF · max 2 Mo · recadrage avant envoi
          </p>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
      </div>

      <ImageCropModal
        open={!!cropSrc}
        imageSrc={cropSrc}
        aspect={1}
        cropShape="round"
        title="Recadrer la photo de profil"
        maxSize={512}
        loading={uploading}
        onClose={closeCrop}
        onConfirm={uploadFile}
      />
    </>
  );
}
