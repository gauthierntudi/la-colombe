import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { cancelInvoice } from "@/lib/services/invoice.service";

type Params = { params: Promise<{ id: string }> };

const cancelSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const body = cancelSchema.parse(await request.json().catch(() => ({})));

    const invoice = await cancelInvoice({
      id,
      userId: user.id,
      userRole: user.role,
      reason: body.reason,
    });

    return Response.json({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      cancelledAt: invoice.cancelledAt,
    });
  } catch (error) {
    return formatApiError(error);
  }
}
