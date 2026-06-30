import { createHmac, timingSafeEqual } from "crypto";
import { ApiError } from "@/lib/api-utils";
import { getFlexpaieCredentials } from "@/lib/services/settings.service";

export type FlexpaieProvider = "ORANGE" | "AIRTEL" | "VODACOM";

const PROVIDER_TYPE: Record<FlexpaieProvider, string> = {
  ORANGE: "1",
  AIRTEL: "2",
  VODACOM: "3",
};

export function normalizeRdcPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `243${digits.slice(1)}`;
  if (digits.length === 9) return `243${digits}`;
  throw new ApiError("VALIDATION_ERROR", "Numéro invalide (format +243...)", 422);
}

export function verifyFlexpaieWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | null
) {
  if (!secret) return true;
  if (!signature) {
    throw new ApiError("FORBIDDEN", "Signature webhook manquante", 403);
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");

  try {
    if (
      timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"))
    ) {
      return true;
    }
  } catch {
    // length mismatch
  }

  throw new ApiError("FORBIDDEN", "Signature webhook invalide", 403);
}

export async function createFlexpaieMobilePayment(params: {
  amount: number;
  reference: string;
  phone: string;
  provider: FlexpaieProvider;
  callbackUrl: string;
  description?: string;
}) {
  const config = await getFlexpaieCredentials();

  if (config.isMock) {
    const transactionId = `MOCK-${Date.now()}`;
    return {
      transactionId,
      reference: `FP-${params.reference.slice(0, 8).toUpperCase()}`,
      orderNumber: transactionId,
      mock: true,
    };
  }

  const phone = normalizeRdcPhone(params.phone);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      merchant: config.merchantId,
      type: PROVIDER_TYPE[params.provider],
      phone,
      amount: params.amount,
      currency: "CDF",
      reference: params.reference,
      callbackUrl: params.callbackUrl,
      description: params.description ?? `Paiement ${params.reference}`,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      "Erreur lors de l'appel Flexpaie";
    throw new ApiError("FLEXPAIE_ERROR", message, 502);
  }

  const orderNumber =
    (typeof data.orderNumber === "string" && data.orderNumber) ||
    (typeof data.transactionId === "string" && data.transactionId) ||
    null;

  if (!orderNumber) {
    throw new ApiError("FLEXPAIE_ERROR", "Réponse Flexpaie invalide", 502);
  }

  return {
    transactionId: orderNumber,
    reference:
      (typeof data.reference === "string" && data.reference) || params.reference,
    orderNumber,
    mock: false,
  };
}

export function getFlexpaieCallbackUrl(requestOrigin?: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    requestOrigin ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/v1/webhooks/flexpaie`;
}
