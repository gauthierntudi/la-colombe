import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { normalizeAssetForStorage, resolveAssetUrl } from "@/lib/assets";
import { formatApiError, parsePagination, paginatedResponse } from "@/lib/api-utils";

const createSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  unitPrice: z.number().int().positive(),
  taxRate: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const pointOfSaleId = searchParams.get("pointOfSaleId") ?? undefined;
    const active = searchParams.get("active");

    const where = {
      ...(active === "false"
        ? { active: false }
        : active === "all"
          ? {}
          : { active: true }),
      ...(categoryId ? { categoryId } : {}),
      ...(pointOfSaleId ? { stock: { some: { pointOfSaleId } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
              { barcode: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const data = products.map((p) => ({
      ...p,
      imageUrl: resolveAssetUrl(p.imageUrl),
      unitPrice: Number(p.unitPrice),
      taxRate: Number(p.taxRate),
    }));

    return Response.json(paginatedResponse(data, total, page, limit));
  } catch (error) {
    return formatApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER");

    const body = createSchema.parse(await request.json());

    const product = await prisma.product.create({
      data: {
        name: body.name,
        sku: body.sku,
        barcode: body.barcode ?? null,
        description: body.description ?? null,
        imageUrl: normalizeAssetForStorage(body.imageUrl),
        categoryId: body.categoryId ?? null,
        unitPrice: body.unitPrice,
        taxRate: body.taxRate ?? 16,
        minStockLevel: body.minStockLevel ?? 0,
      },
      include: { category: true },
    });

    return Response.json(
      {
        ...product,
        imageUrl: resolveAssetUrl(product.imageUrl),
        unitPrice: Number(product.unitPrice),
        taxRate: Number(product.taxRate),
      },
      { status: 201 }
    );
  } catch (error) {
    return formatApiError(error);
  }
}
