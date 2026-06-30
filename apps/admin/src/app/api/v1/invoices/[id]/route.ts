import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { getInvoice, updateInvoice } from "@/lib/services/invoice.service";

type Params = { params: Promise<{ id: string }> };

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
});

const patchSchema = z.object({
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await getAuthUser(_request);
    const { id } = await params;
    const invoice = await getInvoice(id);
    return Response.json(invoice);
  } catch (error) {
    return formatApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER", "FACTURANT");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    const invoice = await updateInvoice(id, {
      ...body,
      userId: user.id,
      userRole: user.role,
    });

    return Response.json(invoice);
  } catch (error) {
    return formatApiError(error);
  }
}
