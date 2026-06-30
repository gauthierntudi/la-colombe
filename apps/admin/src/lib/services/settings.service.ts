import { prisma } from "@ges/database";
import { ApiError } from "@/lib/api-utils";

const SETTINGS_ID = "default-settings";

function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

export async function getShopSettings() {
  let settings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: {
        id: SETTINGS_ID,
        name: "La Colombe",
        currency: "CDF",
        defaultTaxRate: 16,
        country: "CD",
      },
    });
  }

  return {
    id: settings.id,
    name: settings.name,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    currency: settings.currency,
    defaultTaxRate: Number(settings.defaultTaxRate),
    invoiceExpiryH: settings.invoiceExpiryH,
    country: settings.country,
    flexpaieMerchantId: settings.flexpaieMerchantId,
    flexpaieApiKeyMasked: maskSecret(settings.flexpaieApiKey),
    flexpaieWebhookSecretMasked: maskSecret(settings.flexpaieWebhookSecret),
    hasFlexpaieApiKey: !!settings.flexpaieApiKey,
    hasFlexpaieWebhookSecret: !!settings.flexpaieWebhookSecret,
    hasYocoIntegrationSecret: !!settings.yocoIntegrationSecret,
    updatedAt: settings.updatedAt,
  };
}

export async function getYocoSdkSettings() {
  const settings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const integrationSecret =
    settings?.yocoIntegrationSecret || process.env.YOCO_INTEGRATION_SECRET || null;

  if (!integrationSecret) {
    return null;
  }

  return {
    integrationSecret,
    merchantId: settings?.flexpaieMerchantId ?? settings?.id ?? "ges-boutique",
    merchantName: settings?.name ?? "La Colombe",
    merchantPhone: settings?.phone ?? "",
    merchantAddress: settings?.address ?? "",
    sandbox: process.env.YOCO_ENVIRONMENT === "SANDBOX",
  };
}

export async function updateShopSettings(data: {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  defaultTaxRate?: number;
  invoiceExpiryH?: number;
  flexpaieMerchantId?: string | null;
  flexpaieApiKey?: string | null;
  flexpaieWebhookSecret?: string | null;
  yocoIntegrationSecret?: string | null;
}) {
  const existing = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Paramètres introuvables", 404);
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.address !== undefined) updateData.address = data.address?.trim() || null;
  if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
  if (data.email !== undefined) updateData.email = data.email?.trim() || null;
  if (data.defaultTaxRate !== undefined) updateData.defaultTaxRate = data.defaultTaxRate;
  if (data.invoiceExpiryH !== undefined) updateData.invoiceExpiryH = data.invoiceExpiryH;
  if (data.flexpaieMerchantId !== undefined) {
    updateData.flexpaieMerchantId = data.flexpaieMerchantId?.trim() || null;
  }
  if (data.flexpaieApiKey !== undefined && data.flexpaieApiKey !== "") {
    updateData.flexpaieApiKey = data.flexpaieApiKey;
  }
  if (data.flexpaieWebhookSecret !== undefined && data.flexpaieWebhookSecret !== "") {
    updateData.flexpaieWebhookSecret = data.flexpaieWebhookSecret;
  }
  if (data.yocoIntegrationSecret !== undefined && data.yocoIntegrationSecret !== "") {
    updateData.yocoIntegrationSecret = data.yocoIntegrationSecret;
  }

  await prisma.shopSettings.update({
    where: { id: SETTINGS_ID },
    data: updateData,
  });

  return getShopSettings();
}

export async function getFlexpaieCredentials() {
  const settings = await prisma.shopSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const apiKey = settings?.flexpaieApiKey || process.env.FLEXPAIE_API_KEY || null;
  const merchantId =
    settings?.flexpaieMerchantId || process.env.FLEXPAIE_MERCHANT_ID || null;
  const webhookSecret =
    settings?.flexpaieWebhookSecret || process.env.FLEXPAIE_WEBHOOK_SECRET || null;

  return {
    apiKey,
    merchantId,
    webhookSecret,
    isMock: !apiKey || !merchantId,
    apiUrl:
      process.env.FLEXPAIE_API_URL ||
      "https://backend.flexpay.cd/api/rest/v1/paymentService",
  };
}
