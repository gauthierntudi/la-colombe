import { NextRequest } from "next/server";
import { z } from "zod";
import { PointOfSaleType, prisma } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";

const createSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  type: z.nativeEnum(PointOfSaleType).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  invoicePrefix: z.string().optional(),
  yocoPrintEnabled: z.boolean().optional(),
  yocoDeviceId: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as PointOfSaleType | null;
    const active = searchParams.get("active");

    const points = await prisma.pointOfSale.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(active === "all"
          ? {}
          : active === "false"
            ? { active: false }
            : { active: true }),
      },
      orderBy: { name: "asc" },
    });

    return Response.json({ data: points });
  } catch (error) {
    return formatApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN");

    const body = createSchema.parse(await request.json());

    const point = await prisma.pointOfSale.create({
      data: {
        code: body.code.toUpperCase(),
        name: body.name,
        type: body.type ?? PointOfSaleType.STORE,
        address: body.address ?? null,
        phone: body.phone ?? null,
        invoicePrefix: body.invoicePrefix ?? "FAC",
        yocoPrintEnabled: body.yocoPrintEnabled ?? false,
        yocoDeviceId: body.yocoDeviceId ?? null,
      },
    });

    return Response.json(point, { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
