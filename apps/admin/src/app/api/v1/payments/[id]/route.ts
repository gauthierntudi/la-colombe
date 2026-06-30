import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { getPaymentById } from "@/lib/services/payment.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await getAuthUser(_request);
    const { id } = await params;
    const payment = await getPaymentById(id);
    return Response.json(payment);
  } catch (error) {
    return formatApiError(error);
  }
}
