import { NextRequest } from "next/server";
import { z } from "zod";
import { StockMovementType } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError, paginatedResponse, parsePagination } from "@/lib/api-utils";
import { listMovements } from "@/lib/services/inventory.service";

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const typeParam = searchParams.get("type");
    const type =
      typeParam && Object.values(StockMovementType).includes(typeParam as StockMovementType)
        ? (typeParam as StockMovementType)
        : undefined;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const result = await listMovements({
      pointOfSaleId: searchParams.get("pointOfSaleId") ?? undefined,
      productId: searchParams.get("productId") ?? undefined,
      type,
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(toParam) : undefined,
      page,
      limit,
    });

    return Response.json(
      paginatedResponse(result.data, result.total, result.page, result.limit)
    );
  } catch (error) {
    return formatApiError(error);
  }
}
