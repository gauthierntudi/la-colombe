import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { transferStock } from "@/lib/services/inventory.service";

const transferSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER");

    const body = transferSchema.parse(await request.json());

    const transfer = await transferStock({
      ...body,
      userId: user.id,
    });

    return Response.json(transfer, { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
