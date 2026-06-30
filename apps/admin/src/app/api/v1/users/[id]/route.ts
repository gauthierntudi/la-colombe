import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, prisma } from "@ges/database";
import { getAuthUser, hashPassword, requireRole } from "@/lib/auth";
import { normalizeAssetForStorage, resolveAssetUrl } from "@/lib/assets";
import { ApiError, formatApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
  avatarUrl: z.string().nullable().optional(),
  pointOfSaleIds: z.array(z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  active: boolean;
  createdAt: Date;
  pointOfSales?: { pointOfSale: { id: string; code: string; name: string; type: string } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: resolveAssetUrl(user.avatarUrl),
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    pointOfSales:
      user.pointOfSales?.map((p) => ({
        id: p.pointOfSale.id,
        code: p.pointOfSale.code,
        name: p.pointOfSale.name,
        type: p.pointOfSale.type,
      })) ?? [],
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const authUser = await getAuthUser(request);
    requireRole(authUser.role, "ADMIN");
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { pointOfSales: { include: { pointOfSale: true } } },
    });

    if (!user) {
      throw new ApiError("NOT_FOUND", "Utilisateur introuvable", 404);
    }

    return Response.json(serializeUser(user));
  } catch (error) {
    return formatApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const authUser = await getAuthUser(request);
    requireRole(authUser.role, "ADMIN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    if (id === authUser.id && body.active === false) {
      throw new ApiError("VALIDATION_ERROR", "Vous ne pouvez pas désactiver votre propre compte", 422);
    }

    if (body.email) {
      const dup = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase(), NOT: { id } },
      });
      if (dup) {
        throw new ApiError("VALIDATION_ERROR", "Cet email est déjà utilisé", 422);
      }
    }

    const { password, pointOfSaleIds, avatarUrl, ...rest } = body;

    const user = await prisma.$transaction(async (tx) => {
      if (pointOfSaleIds !== undefined) {
        await tx.userPointOfSale.deleteMany({ where: { userId: id } });
        if (pointOfSaleIds.length > 0) {
          await tx.userPointOfSale.createMany({
            data: pointOfSaleIds.map((pointOfSaleId) => ({
              userId: id,
              pointOfSaleId,
            })),
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          ...rest,
          ...(body.email ? { email: body.email.toLowerCase() } : {}),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
          ...(avatarUrl !== undefined
            ? { avatarUrl: normalizeAssetForStorage(avatarUrl) }
            : {}),
        },
        include: { pointOfSales: { include: { pointOfSale: true } } },
      });
    });

    return Response.json(serializeUser(user));
  } catch (error) {
    return formatApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const authUser = await getAuthUser(request);
    requireRole(authUser.role, "ADMIN");
    const { id } = await params;

    if (id === authUser.id) {
      throw new ApiError("VALIDATION_ERROR", "Vous ne pouvez pas supprimer votre propre compte", 422);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            invoices: true,
            cashSessions: true,
            stockMoves: true,
            transfers: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError("NOT_FOUND", "Utilisateur introuvable", 404);
    }

    const { invoices, cashSessions, stockMoves, transfers } = user._count;
    const hasHistory = invoices + cashSessions + stockMoves + transfers > 0;

    if (hasHistory) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Impossible de supprimer : cet utilisateur a un historique (factures, caisse, stock). Désactivez-le plutôt.",
        409,
        { invoices, cashSessions, stockMoves, transfers }
      );
    }

    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", active: true, NOT: { id } },
      });
      if (adminCount === 0) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "Impossible de supprimer le dernier administrateur actif",
          409
        );
      }
    }

    await prisma.user.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    return formatApiError(error);
  }
}
