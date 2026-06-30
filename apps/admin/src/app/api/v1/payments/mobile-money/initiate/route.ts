import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { initiateMobileMoneyPayment } from "@/lib/services/payment.service";

const initiateSchema = z.object({
  invoiceId: z.string().min(1),
  cashSessionId: z.string().optional().nullable(),
  amount: z.number().int().positive(),
  phone: z.string().min(9),
  provider: z.enum(["ORANGE", "AIRTEL", "VODACOM"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const body = initiateSchema.parse(await request.json());
    const origin = new URL(request.url).origin;

    const result = await initiateMobileMoneyPayment({
      ...body,
      userId: user.id,
      userRole: user.role,
      requestOrigin: origin,
    });

    return Response.json(result, { status: 202 });
  } catch (error) {
    return formatApiError(error);
  }
}
