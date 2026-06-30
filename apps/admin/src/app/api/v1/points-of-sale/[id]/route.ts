import { NextRequest } from "next/server";
import { z } from "zod";
import { PointOfSaleType, prisma } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { ApiError, formatApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  code: z.string().min(2).optional(),
  name: z.string().min(1).optional(),
  type: z.nativeEnum(PointOfSaleType).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  active: z.boolean().optional(),
  invoicePrefix: z.string().optional(),
  yocoPrintEnabled: z.boolean().optional(),
  yocoDeviceId: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await getAuthUser(request);
    const { id } = await params;

    const point = await prisma.pointOfSale.findUnique({ where: { id } });
    if (!point) {
      throw new ApiError("NOT_FOUND", "Point de vente introuvable", 404);
    }

    return Response.json(point);
  } catch (error) {
    return formatApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    if (body.code) {
      const dup = await prisma.pointOfSale.findFirst({
        where: { code: body.code.toUpperCase(), NOT: { id } },
      });
      if (dup) {
        throw new ApiError("VALIDATION_ERROR", "Ce code est déjà utilisé", 422);
      }
    }

    const point = await prisma.pointOfSale.update({
      where: { id },
      data: {
        ...body,
        ...(body.code ? { code: body.code.toUpperCase() } : {}),
      },
    });

    return Response.json(point);
  } catch (error) {
    return formatApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN");
    const { id } = await params;

    const point = await prisma.pointOfSale.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            invoices: true,
            cashSessions: true,
            movements: true,
            stock: true,
            userAssignments: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });

    if (!point) {
      throw new ApiError("NOT_FOUND", "Point de vente introuvable", 404);
    }

    const c = point._count;
    const hasHistory =
      c.invoices +
        c.cashSessions +
        c.movements +
        c.stock +
        c.userAssignments +
        c.transfersFrom +
        c.transfersTo >
      0;

    if (hasHistory) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Impossible de supprimer : ce site a un historique (factures, stock, utilisateurs assignés). Désactivez-le plutôt.",
        409,
        c
      );
    }

    await prisma.pointOfSale.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    return formatApiError(error);
  }
}
