import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { ApiError, formatApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await getAuthUser(request);
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      throw new ApiError("NOT_FOUND", "Catégorie introuvable", 404);
    }

    return Response.json({
      ...category,
      productCount: category._count.products,
    });
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

    if (body.name) {
      const dup = await prisma.category.findFirst({
        where: {
          name: { equals: body.name, mode: "insensitive" },
          NOT: { id },
        },
      });
      if (dup) {
        throw new ApiError("VALIDATION_ERROR", "Cette catégorie existe déjà", 422);
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...body,
        ...(body.name ? { name: body.name.trim() } : {}),
      },
      include: { _count: { select: { products: true } } },
    });

    return Response.json({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      productCount: category._count.products,
      createdAt: category.createdAt,
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

    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      throw new ApiError("NOT_FOUND", "Catégorie introuvable", 404);
    }

    if (category._count.products > 0) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `Impossible de supprimer : ${category._count.products} produit(s) utilisent cette catégorie. Désactivez-la plutôt.`,
        409,
        { products: category._count.products }
      );
    }

    await prisma.category.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    return formatApiError(error);
  }
}
