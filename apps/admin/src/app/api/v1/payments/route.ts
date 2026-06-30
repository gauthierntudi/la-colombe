import { NextRequest } from "next/server";
import { z } from "zod";
import { PaymentMethod } from "@ges/database";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { processPayments } from "@/lib/services/payment.service";

const paymentLineSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().int().positive(),
  paymentId: z.string().optional(),
});

const createSchema = z.object({
  invoiceId: z.string().min(1),
  cashSessionId: z.string().optional().nullable(),
  payments: z.array(paymentLineSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const body = createSchema.parse(await request.json());

    const result = await processPayments({
      invoiceId: body.invoiceId,
      cashSessionId: body.cashSessionId,
      payments: body.payments,
      userId: user.id,
      userRole: user.role,
    });

    return Response.json(result);
  } catch (error) {
    return formatApiError(error);
  }
}
