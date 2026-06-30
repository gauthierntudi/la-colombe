import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { simulateMobileMoneyConfirmation } from "@/lib/services/payment.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(_request);
    const { id } = await params;
    const result = await simulateMobileMoneyConfirmation(id, user.role);
    return Response.json(result);
  } catch (error) {
    return formatApiError(error);
  }
}
