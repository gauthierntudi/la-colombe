import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { closeCashSession } from "@/lib/services/cash-session.service";

type Params = { params: Promise<{ id: string }> };

const closeSchema = z.object({
  closingCash: z.number().int().min(0),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const body = closeSchema.parse(await request.json());

    const session = await closeCashSession({
      sessionId: id,
      userId: user.id,
      userRole: user.role,
      closingCash: body.closingCash,
      notes: body.notes,
    });

    return Response.json(session);
  } catch (error) {
    return formatApiError(error);
  }
}
