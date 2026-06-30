import { NextRequest } from "next/server";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { getInvoice, validateInvoice } from "@/lib/services/invoice.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER", "FACTURANT");
    const { id } = await params;

    await validateInvoice(id, user.id, user.role);
    const invoice = await getInvoice(id);

    return Response.json(invoice);
  } catch (error) {
    return formatApiError(error);
  }
}
