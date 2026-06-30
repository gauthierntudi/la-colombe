import { NextRequest } from "next/server";
import { getAuthUser, requireRole } from "@/lib/auth";
import { ApiError, formatApiError } from "@/lib/api-utils";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, readImageBuffer, validateImageFile } from "@/lib/upload-image";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "Fichier image requis", 422);
    }

    validateImageFile(file);

    const key = buildImageKey("products", file);
    const buffer = await readImageBuffer(file);
    const url = await uploadToS3(key, buffer, file.type);

    return Response.json({ url });
  } catch (error) {
    return formatApiError(error);
  }
}
