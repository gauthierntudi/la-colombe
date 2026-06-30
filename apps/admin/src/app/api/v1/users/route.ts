import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, prisma } from "@ges/database";
import { getAuthUser, hashPassword, requireRole } from "@/lib/auth";
import { normalizeAssetForStorage, resolveAssetUrl } from "@/lib/assets";
import { ApiError, formatApiError, parsePagination, paginatedResponse } from "@/lib/api-utils";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.nativeEnum(Role),
  avatarUrl: z.string().nullable().optional(),
  pointOfSaleIds: z.array(z.string()).optional(),
});

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

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    requireRole(authUser.role, "ADMIN");

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search") ?? undefined;
    const role = searchParams.get("role") as Role | null;
    const active = searchParams.get("active");

    const where = {
      ...(role ? { role } : {}),
      ...(active === "false"
        ? { active: false }
        : active === "all"
          ? {}
          : { active: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { pointOfSales: { include: { pointOfSale: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return Response.json(
      paginatedResponse(users.map(serializeUser), total, page, limit)
    );
  } catch (error) {
    return formatApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    requireRole(authUser.role, "ADMIN");

    const body = createSchema.parse(await request.json());

    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      throw new ApiError("VALIDATION_ERROR", "Cet email est déjà utilisé", 422);
    }

    const passwordHash = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name,
        role: body.role,
        avatarUrl: normalizeAssetForStorage(body.avatarUrl),
        pointOfSales: body.pointOfSaleIds?.length
          ? {
              create: body.pointOfSaleIds.map((pointOfSaleId) => ({
                pointOfSaleId,
              })),
            }
          : undefined,
      },
      include: { pointOfSales: { include: { pointOfSale: true } } },
    });

    return Response.json(serializeUser(user), { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
