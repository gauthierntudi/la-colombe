import { NextRequest } from "next/server";
import { z } from "zod";
import { StockMovementType } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { receiveStock } from "@/lib/services/inventory.service";

const receiveSchema = z.object({
  pointOfSaleId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER");

    const body = receiveSchema.parse(await request.json());

    const movement = await receiveStock({
      ...body,
      userId: user.id,
    });

    return Response.json(movement, { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
