import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@ges/database";
import {
  getAuthUser,
  hashPassword,
  serializeUser,
  verifyPassword,
} from "@/lib/auth";
import { normalizeAssetForStorage } from "@/lib/assets";
import { ApiError, formatApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().nullable().optional(),
  password: z.string().min(6).optional(),
  currentPassword: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    return Response.json({ user: await serializeUser(user) });
  } catch (error) {
    return formatApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    const body = updateSchema.parse(await request.json());

    const emailChanging =
      body.email !== undefined &&
      body.email.toLowerCase() !== authUser.email.toLowerCase();

    if (body.password && !body.currentPassword) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Le mot de passe actuel est requis pour en définir un nouveau",
        422
      );
    }

    if (emailChanging && !body.currentPassword) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Le mot de passe actuel est requis pour changer l'adresse email",
        422
      );
    }

    if (body.currentPassword) {
      const valid = await verifyPassword(body.currentPassword, authUser.passwordHash);
      if (!valid) {
        throw new ApiError("VALIDATION_ERROR", "Mot de passe actuel incorrect", 422);
      }
    }

    if (emailChanging && body.email) {
      const dup = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase(), NOT: { id: authUser.id } },
      });
      if (dup) {
        throw new ApiError("VALIDATION_ERROR", "Cet email est déjà utilisé", 422);
      }
    }

    const user = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(emailChanging && body.email ? { email: body.email.toLowerCase() } : {}),
        ...(body.avatarUrl !== undefined
          ? { avatarUrl: normalizeAssetForStorage(body.avatarUrl) }
          : {}),
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
      },
      include: { pointOfSales: { include: { pointOfSale: true } } },
    });

    return Response.json({ user: await serializeUser(user) });
  } catch (error) {
    return formatApiError(error);
  }
}
