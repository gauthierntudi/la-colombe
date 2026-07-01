import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { getShopSettings, updateShopSettings } from "@/lib/services/settings.service";

export async function GET(request: NextRequest) {
  try {
    await getAuthUser(request);
    const settings = await getShopSettings();
    return Response.json(settings);
  } catch (error) {
    return formatApiError(error);
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  rccm: z.string().nullable().optional(),
  idNat: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  invoiceExpiryH: z.number().int().min(1).max(168).optional(),
  flexpaieMerchantId: z.string().nullable().optional(),
  flexpaieApiKey: z.string().nullable().optional(),
  flexpaieWebhookSecret: z.string().nullable().optional(),
  yocoIntegrationSecret: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN");

    const body = updateSchema.parse(await request.json());
    const settings = await updateShopSettings({
      ...body,
      email: body.email === "" ? null : body.email,
    });

    return Response.json(settings);
  } catch (error) {
    return formatApiError(error);
  }
}
