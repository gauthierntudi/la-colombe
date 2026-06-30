import { NextRequest } from "next/server";
import { z } from "zod";
import { InvoiceStatus } from "@ges/database";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError, paginatedResponse, parsePagination } from "@/lib/api-utils";
import { createInvoice, listInvoices } from "@/lib/services/invoice.service";

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
});

const createSchema = z.object({
  pointOfSaleId: z.string().min(1),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);

    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(InvoiceStatus).includes(statusParam as InvoiceStatus)
        ? (statusParam as InvoiceStatus)
        : undefined;

    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const result = await listInvoices({
      pointOfSaleId: searchParams.get("pointOfSaleId") ?? undefined,
      status,
      search: searchParams.get("search") ?? undefined,
      from: fromParam ? new Date(fromParam) : undefined,
      to: toParam ? new Date(`${toParam}T23:59:59.999Z`) : undefined,
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER", "FACTURANT");

    const body = createSchema.parse(await request.json());
    const invoice = await createInvoice({
      ...body,
      userId: user.id,
      userRole: user.role,
    });

    return Response.json(invoice, { status: 201 });
  } catch (error) {
    return formatApiError(error);
  }
}
