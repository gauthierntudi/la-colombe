import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { getCashSessionSummary } from "@/lib/services/cash-session.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await getAuthUser(_request);
    const { id } = await params;
    const summary = await getCashSessionSummary(id);
    return Response.json(summary);
  } catch (error) {
    return formatApiError(error);
  }
}
