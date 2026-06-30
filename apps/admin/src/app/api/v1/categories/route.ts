import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { ApiError, formatApiError } from "@/lib/api-utils";

const createSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const categories = await prisma.category.findMany({
      where:
        active === "all"
          ? {}
          : active === "false"
            ? { active: false }
            : { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true } },
      },
    });

    return Response.json({
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        active: c.active,
        productCount: c._count.products,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    return formatApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN");

    const body = createSchema.parse(await request.json());

    const existing = await prisma.category.findFirst({
      where: { name: { equals: body.name, mode: "insensitive" } },
    });
    if (existing) {
      throw new ApiError("VALIDATION_ERROR", "Cette catégorie existe déjà", 422);
    }

    const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });

    const category = await prisma.category.create({
      data: {
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    return Response.json({ ...category, productCount: 0 }, { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
