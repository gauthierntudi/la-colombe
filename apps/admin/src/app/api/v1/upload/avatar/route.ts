import { NextRequest } from "next/server";
import { prisma } from "@ges/database";
import { getAuthUser, requireRole, serializeUser } from "@/lib/auth";
import { ApiError, formatApiError } from "@/lib/api-utils";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, readImageBuffer, validateImageFile } from "@/lib/upload-image";

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    const formData = await request.formData();
    const file = formData.get("file");
    const targetUserId = formData.get("userId");
    const persist = formData.get("persist") !== "false";

    if (!file || !(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "Fichier image requis", 422);
    }

    let userId = authUser.id;

    if (targetUserId && typeof targetUserId === "string" && targetUserId !== authUser.id) {
      requireRole(authUser.role, "ADMIN");
      const target = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!target) {
        throw new ApiError("NOT_FOUND", "Utilisateur introuvable", 404);
      }
      userId = targetUserId;
    } else if (!persist) {
      requireRole(authUser.role, "ADMIN");
      userId = "pending";
    }

    validateImageFile(file);

    const key = buildImageKey(`avatars/${userId}`, file);
    const buffer = await readImageBuffer(file);
    const url = await uploadToS3(key, buffer, file.type);

    if (!persist) {
      return Response.json({ url });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: key },
      include: { pointOfSales: { include: { pointOfSale: true } } },
    });

    return Response.json({ url, user: await serializeUser(user) });
  } catch (error) {
    return formatApiError(error);
  }
}
