import { randomUUID } from "crypto";
import { ApiError } from "./api-utils";

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 Mo
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Format non supporté (JPEG, PNG, WebP, GIF uniquement)",
      422
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new ApiError("VALIDATION_ERROR", "Image trop volumineuse (max 2 Mo)", 422);
  }
}

export function buildImageKey(folder: string, file: File): string {
  const ext =
    EXT_BY_MIME[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  return `${folder}/${randomUUID()}.${ext}`;
}

export async function readImageBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}
