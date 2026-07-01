import { NextRequest } from "next/server";
import { InvoiceStatus } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError, paginatedResponse, parsePagination } from "@/lib/api-utils";
import {
  getDashboardSummary,
  getInventoryValuation,
  getSalesReport,
  getLowStockAlerts,
  getStockActivityReport,
  getTopProductsReport,
  getSalesLinesReport,
} from "@/lib/services/reports.service";

function parseDateRange(searchParams: URLSearchParams) {
  const now = new Date();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam
    ? new Date(fromParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now;
  return { from, to };
}

function parseSummaryDateRange(searchParams: URLSearchParams) {
  const now = new Date();
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : now;
  const from = fromParam
    ? new Date(fromParam)
    : (() => {
        const d = new Date(to);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
  return { from, to };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "summary";
    const pointOfSaleId = searchParams.get("pointOfSaleId") ?? undefined;

    const restrictedTypes = ["sales", "top-products", "sales-lines"];
    if (restrictedTypes.includes(type)) {
      requireRole(user.role, "ADMIN", "MANAGER");
    }

    if (type === "summary") {
      const { from, to } = parseSummaryDateRange(searchParams);
      return Response.json(
        await getDashboardSummary({ pointOfSaleId, from, to })
      );
    }

    if (type === "sales") {
      const { from, to } = parseDateRange(searchParams);
      const groupBy = searchParams.get("groupBy") === "month" ? "month" : "day";
      const productId = searchParams.get("productId") ?? undefined;
      return Response.json(
        await getSalesReport({ pointOfSaleId, productId, from, to, groupBy })
      );
    }

    if (type === "top-products") {
      const { from, to } = parseDateRange(searchParams);
      const limit = parseInt(searchParams.get("limit") ?? "10", 10);
      const productId = searchParams.get("productId") ?? undefined;
      return Response.json({
        data: await getTopProductsReport({ pointOfSaleId, productId, from, to, limit }),
      });
    }

    if (type === "sales-lines") {
      const { from, to } = parseDateRange(searchParams);
      const { page, limit } = parsePagination(searchParams);
      const productId = searchParams.get("productId") ?? undefined;
      const statusParam = searchParams.get("status");
      const status =
        statusParam === "ALL"
          ? undefined
          : statusParam && Object.values(InvoiceStatus).includes(statusParam as InvoiceStatus)
            ? (statusParam as InvoiceStatus)
            : InvoiceStatus.PAID;

      const result = await getSalesLinesReport({
        pointOfSaleId,
        productId,
        status,
        from,
        to,
        page,
        limit,
      });

      return Response.json({
        ...paginatedResponse(result.data, result.total, result.page, result.limit),
        summary: result.summary,
      });
    }

    if (type === "inventory-valuation") {
      return Response.json(await getInventoryValuation(pointOfSaleId));
    }

    if (type === "stock-activity") {
      const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
      return Response.json({ data: await getStockActivityReport(year) });
    }

    if (type === "low-stock") {
      const limit = parseInt(searchParams.get("limit") ?? "20", 10);
      return Response.json({
        data: await getLowStockAlerts({ pointOfSaleId, limit }),
      });
    }

    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Type de rapport inconnu" } }, {
      status: 422,
    });
  } catch (error) {
    return formatApiError(error);
  }
}
