import { NextRequest } from "next/server";
import { z } from "zod";
import { CashSessionStatus } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError, paginatedResponse, parsePagination } from "@/lib/api-utils";
import {
  getOpenSessionForUser,
  listCashSessions,
  openCashSession,
} from "@/lib/services/cash-session.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get("mine") === "true";

    if (mine) {
      const session = await getOpenSessionForUser(
        user.id,
        searchParams.get("pointOfSaleId") ?? undefined
      );
      return Response.json({ data: session });
    }

    const { page, limit } = parsePagination(searchParams);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(CashSessionStatus).includes(statusParam as CashSessionStatus)
        ? (statusParam as CashSessionStatus)
        : undefined;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const result = await listCashSessions({
      pointOfSaleId: searchParams.get("pointOfSaleId") ?? undefined,
      status,
      search: searchParams.get("search") ?? undefined,
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(`${toParam}T23:59:59.999Z`) : undefined,
      page,
      limit,
    });

    return Response.json({
      ...paginatedResponse(result.data, result.total, result.page, result.limit),
      summary: result.summary,
    });
  } catch (error) {
    return formatApiError(error);
  }
}

const openSchema = z.object({
  pointOfSaleId: z.string().min(1),
  openingCash: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER", "CAISSIER");
    const body = openSchema.parse(await request.json());

    const session = await openCashSession({
      userId: user.id,
      userRole: user.role,
      pointOfSaleId: body.pointOfSaleId,
      openingCash: body.openingCash,
    });

    return Response.json(session, { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
