import { NextRequest } from "next/server";
import { formatApiError } from "@/lib/api-utils";
import { expireStaleInvoices } from "@/lib/services/invoice.service";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
    }

    const auth = request.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    const querySecret = new URL(request.url).searchParams.get("secret");

    if (bearer !== secret && querySecret !== secret) {
      return Response.json({ error: "Non autorisé" }, { status: 401 });
    }

    const expiredCount = await expireStaleInvoices();
    return Response.json({ ok: true, expiredCount });
  } catch (error) {
    return formatApiError(error);
  }
}
