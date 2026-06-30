import { NextRequest } from "next/server";
import { z } from "zod";
import { formatApiError } from "@/lib/api-utils";
import { verifyFlexpaieWebhookSignature } from "@/lib/flexpaie.client";
import { getFlexpaieCredentials } from "@/lib/services/settings.service";
import { handleFlexpaieWebhook } from "@/lib/services/payment.service";

const webhookSchema = z.object({
  transactionId: z.string().min(1),
  reference: z.string().min(1),
  status: z.string().min(1),
  amount: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const config = await getFlexpaieCredentials();
    const signature =
      request.headers.get("x-flexpaie-signature") ||
      request.headers.get("x-flexpay-signature");

    verifyFlexpaieWebhookSignature(rawBody, signature, config.webhookSecret);

    const payload = webhookSchema.parse(JSON.parse(rawBody));
    const result = await handleFlexpaieWebhook(payload);
    return Response.json(result);
  } catch (error) {
    return formatApiError(error);
  }
}
