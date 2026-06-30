import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { listInventory } from "@/lib/services/inventory.service";

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const pointOfSaleId = searchParams.get("pointOfSaleId");
    const search = searchParams.get("search") ?? undefined;
    const belowMinStock = searchParams.get("belowMinStock") === "true";

    if (!pointOfSaleId) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "pointOfSaleId requis" } },
        { status: 422 }
      );
    }

    const data = await listInventory(pointOfSaleId, search, belowMinStock);
    return Response.json({ data });
  } catch (error) {
    return formatApiError(error);
  }
}
