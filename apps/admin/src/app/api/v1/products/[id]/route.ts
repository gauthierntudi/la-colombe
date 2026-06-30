import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { normalizeAssetForStorage, resolveAssetUrl } from "@/lib/assets";
import { ApiError, formatApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  unitPrice: z.number().int().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw new ApiError("NOT_FOUND", "Produit introuvable", 404);
    }

    return Response.json({
      ...product,
      imageUrl: resolveAssetUrl(product.imageUrl),
      unitPrice: Number(product.unitPrice),
      taxRate: Number(product.taxRate),
    });
  } catch (error) {
    return formatApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER");
    const { id } = await params;
    const body = updateSchema.parse(await request.json());

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...body,
        ...(body.imageUrl !== undefined
          ? { imageUrl: normalizeAssetForStorage(body.imageUrl) }
          : {}),
      },
      include: { category: true },
    });

    return Response.json({
      ...product,
      imageUrl: resolveAssetUrl(product.imageUrl),
      unitPrice: Number(product.unitPrice),
      taxRate: Number(product.taxRate),
    });
  } catch (error) {
    return formatApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN");
    const { id } = await params;

    await prisma.product.update({
      where: { id },
      data: { active: false },
    });

    return Response.json({ success: true });
  } catch (error) {
    return formatApiError(error);
  }
}
