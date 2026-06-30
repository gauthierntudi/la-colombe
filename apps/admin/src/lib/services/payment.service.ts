import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  prisma,
  Role,
  StockMovementType,
} from "@ges/database";
import type { Prisma } from "@ges/database";
import { ApiError } from "@/lib/api-utils";
import {
  createFlexpaieMobilePayment,
  getFlexpaieCallbackUrl,
  type FlexpaieProvider,
} from "@/lib/flexpaie.client";
import { getFlexpaieCredentials } from "@/lib/services/settings.service";

type PaymentInput = {
  method: PaymentMethod;
  amount: number;
  paymentId?: string;
};

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type InvoiceWithLines = Prisma.InvoiceGetPayload<{
  include: { lines: true };
}>;

export async function getPaymentById(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { select: { id: true, number: true, status: true, totalTtc: true } },
    },
  });

  if (!payment) {
    throw new ApiError("NOT_FOUND", "Paiement introuvable", 404);
  }

  return serializePayment(payment);
}

export async function initiateMobileMoneyPayment(params: {
  invoiceId: string;
  amount: number;
  phone: string;
  provider: FlexpaieProvider;
  cashSessionId?: string | null;
  userId: string;
  userRole: Role;
  requestOrigin?: string;
}) {
  const { invoiceId, amount, phone, provider, cashSessionId, userId, userRole, requestOrigin } =
    params;

  requirePaymentRole(userRole);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: { where: { status: { in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING] } } },
    },
  });

  if (!invoice) {
    throw new ApiError("NOT_FOUND", "Facture introuvable", 404);
  }
  if (invoice.status !== InvoiceStatus.PENDING_PAYMENT) {
    throw new ApiError("INVALID_STATUS", "Facture non encaissable", 409);
  }

  const completedTotal = invoice.payments
    .filter((p) => p.status === PaymentStatus.COMPLETED)
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(invoice.totalTtc) - completedTotal;

  if (amount <= 0 || amount > remaining) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Montant invalide (restant: ${remaining} FC)`,
      422
    );
  }

  const pending = invoice.payments.find((p) => p.status === PaymentStatus.PENDING);
  if (pending) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Un paiement Mobile Money est déjà en attente sur cette facture",
      409
    );
  }

  const resolvedSessionId = await resolveCashSessionId(userId, userRole, cashSessionId);

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      cashSessionId: resolvedSessionId,
      method: PaymentMethod.MOBILE_MONEY,
      status: PaymentStatus.PENDING,
      amount,
      customerPhone: phone,
      provider,
    },
  });

  try {
    const flexpaie = await createFlexpaieMobilePayment({
      amount,
      reference: payment.id,
      phone,
      provider,
      callbackUrl: getFlexpaieCallbackUrl(requestOrigin),
      description: `Facture ${invoice.number}`,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        flexpaieTransactionId: flexpaie.transactionId,
        flexpaieReference: flexpaie.reference,
      },
    });

    return {
      paymentId: updated.id,
      status: updated.status,
      flexpaieReference: updated.flexpaieReference,
      mock: flexpaie.mock,
      message: flexpaie.mock
        ? "Mode démo : confirmez la transaction côté client ou utilisez « Simuler confirmation »."
        : "Demande envoyée au client. En attente de confirmation.",
    };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    throw error;
  }
}

export async function simulateMobileMoneyConfirmation(paymentId: string, userRole: Role) {
  const config = await getFlexpaieCredentials();
  if (!config.isMock) {
    throw new ApiError("VALIDATION_ERROR", "Simulation disponible uniquement en mode démo", 422);
  }

  const allowedRoles: Role[] = [Role.ADMIN, Role.MANAGER, Role.CAISSIER];
  if (!allowedRoles.includes(userRole)) {
    throw new ApiError("FORBIDDEN", "Simulation non autorisée", 403);
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== PaymentStatus.PENDING) {
    throw new ApiError("INVALID_STATUS", "Paiement non simulable", 409);
  }

  return handleFlexpaieWebhook({
    transactionId: payment.flexpaieTransactionId ?? payment.id,
    reference: payment.flexpaieReference ?? payment.id,
    status: "SUCCESS",
    amount: Number(payment.amount),
  });
}

export async function handleFlexpaieWebhook(payload: {
  transactionId: string;
  reference: string;
  status: string;
  amount: number;
}) {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { flexpaieReference: payload.reference },
        { flexpaieTransactionId: payload.transactionId },
        { id: payload.reference },
      ],
    },
    include: {
      invoice: { include: { lines: true, payments: true } },
    },
  });

  if (!payment) {
    throw new ApiError("NOT_FOUND", "Paiement Flexpaie introuvable", 404);
  }

  if (payment.status === PaymentStatus.COMPLETED) {
    return { ok: true, paymentId: payment.id, invoiceStatus: payment.invoice.status };
  }

  const success = ["SUCCESS", "COMPLETED", "PAID", "0"].includes(
    payload.status.toUpperCase()
  );
  const failed = ["FAILED", "CANCELLED", "EXPIRED", "1"].includes(
    payload.status.toUpperCase()
  );

  if (failed) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });
    return { ok: true, paymentId: payment.id, status: PaymentStatus.FAILED };
  }

  if (!success) {
    throw new ApiError("VALIDATION_ERROR", "Statut Flexpaie non reconnu", 422);
  }

  if (payload.amount !== Number(payment.amount)) {
    throw new ApiError("VALIDATION_ERROR", "Montant webhook incohérent", 422);
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          completedAt: new Date(),
          flexpaieTransactionId: payload.transactionId,
        },
      });

      const invoice = payment.invoice;
      const completedTotal =
        invoice.payments
          .filter((p) => p.status === PaymentStatus.COMPLETED && p.id !== payment.id)
          .reduce((s, p) => s + Number(p.amount), 0) + Number(payment.amount);

      if (completedTotal >= Number(invoice.totalTtc)) {
        await finalizePaidInvoice(tx, invoice, payment.cashSessionId, invoice.createdById);

        if (payment.cashSessionId) {
          const mmOnInvoice = invoice.payments
            .filter((p) => p.method === PaymentMethod.MOBILE_MONEY)
            .reduce((s, p) => s + Number(p.amount), 0);

          await tx.cashSession.update({
            where: { id: payment.cashSessionId },
            data: {
              invoiceCount: { increment: 1 },
              totalSales: { increment: Number(invoice.totalTtc) },
              ...(mmOnInvoice > 0 ? { totalMobileMoney: { increment: mmOnInvoice } } : {}),
            },
          });
        }
      } else if (payment.cashSessionId) {
        await tx.cashSession.update({
          where: { id: payment.cashSessionId },
          data: { totalMobileMoney: { increment: Number(payment.amount) } },
        });
      }

      const refreshed = await tx.invoice.findUnique({ where: { id: invoice.id } });
      return {
        ok: true,
        paymentId: payment.id,
        invoiceStatus: refreshed?.status ?? invoice.status,
      };
    },
    { timeout: 15000 }
  );
}

export async function processPayments(params: {
  invoiceId: string;
  payments: PaymentInput[];
  cashSessionId?: string | null;
  userId: string;
  userRole: Role;
}) {
  const { invoiceId, payments, cashSessionId, userId, userRole } = params;

  if (!payments.length) {
    throw new ApiError("VALIDATION_ERROR", "Au moins un paiement requis", 422);
  }

  requirePaymentRole(userRole);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, payments: { where: { status: PaymentStatus.COMPLETED } } },
  });

  if (!invoice) {
    throw new ApiError("NOT_FOUND", "Facture introuvable", 404);
  }
  if (invoice.status === InvoiceStatus.PAID) {
    throw new ApiError("ALREADY_PAID", "Facture déjà encaissée", 409);
  }
  if (invoice.status !== InvoiceStatus.PENDING_PAYMENT) {
    throw new ApiError("INVALID_STATUS", "Seules les factures en attente peuvent être encaissées", 409);
  }

  const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = Number(invoice.totalTtc) - alreadyPaid;
  const paymentTotal = payments.reduce((s, p) => s + p.amount, 0);

  if (paymentTotal < totalDue) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Montant insuffisant (reçu: ${paymentTotal}, attendu: ${totalDue})`,
      422,
      { received: paymentTotal, expected: totalDue }
    );
  }

  for (const p of payments) {
    if (p.method === PaymentMethod.MOBILE_MONEY && !p.paymentId) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "paymentId requis pour Mobile Money (initier via /payments/mobile-money/initiate)",
        422
      );
    }
  }

  const resolvedSessionId = await resolveCashSessionId(userId, userRole, cashSessionId);

  const totalTtc = Number(invoice.totalTtc);
  const mmAmount = payments
    .filter((p) => p.method === PaymentMethod.MOBILE_MONEY)
    .reduce((s, p) => s + p.amount, 0);

  return prisma.$transaction(
    async (tx) => {
      for (const p of payments) {
        if (p.method === PaymentMethod.MOBILE_MONEY && p.paymentId) {
          const existing = await tx.payment.findUnique({ where: { id: p.paymentId } });
          if (!existing || existing.status !== PaymentStatus.COMPLETED) {
            throw new ApiError("PAYMENT_PENDING", "Paiement Mobile Money non confirmé", 409);
          }
          continue;
        }

        await tx.payment.create({
          data: {
            invoiceId,
            cashSessionId: resolvedSessionId,
            method: p.method,
            status: PaymentStatus.COMPLETED,
            amount: p.amount,
            completedAt: new Date(),
          },
        });
      }

      const updated = await finalizePaidInvoice(tx, invoice, resolvedSessionId, userId);

      if (resolvedSessionId) {
        await tx.cashSession.update({
          where: { id: resolvedSessionId },
          data: {
            invoiceCount: { increment: 1 },
            totalSales: { increment: totalTtc },
            ...(mmAmount > 0 ? { totalMobileMoney: { increment: mmAmount } } : {}),
          },
        });
      }

      return {
        invoiceId: updated.id,
        number: updated.number,
        status: updated.status,
        paidAt: updated.paidAt,
        totalTtc: Number(updated.totalTtc),
      };
    },
    { timeout: 15000 }
  );
}

async function finalizePaidInvoice(
  tx: TxClient,
  invoice: InvoiceWithLines,
  cashSessionId: string | null,
  userId: string | null
) {
  const productIds = [...new Set(invoice.lines.map((l) => l.productId))];
  if (productIds.length > 0) {
    const stocks = await tx.productStock.findMany({
      where: {
        pointOfSaleId: invoice.pointOfSaleId,
        productId: { in: productIds },
      },
    });
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s]));

    await Promise.all(
      invoice.lines.map((line) => {
        const stock = stockByProduct.get(line.productId);
        if (!stock) return Promise.resolve();

        return tx.productStock.update({
          where: { id: stock.id },
          data: {
            physicalStock: stock.physicalStock - line.quantity,
            reservedStock: Math.max(0, stock.reservedStock - line.quantity),
          },
        });
      })
    );

    if (userId) {
      const movements = invoice.lines
        .filter((line) => stockByProduct.has(line.productId))
        .map((line) => ({
          productId: line.productId,
          pointOfSaleId: invoice.pointOfSaleId,
          type: StockMovementType.SALE_OUT,
          quantity: -line.quantity,
          reason: `Vente facture ${invoice.number}`,
          invoiceId: invoice.id,
          userId,
        }));

      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements });
      }
    }
  }

  return tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.PAID,
      paidAt: new Date(),
      cashSessionId,
    },
    include: {
      pointOfSale: { select: { id: true, code: true, name: true } },
      payments: true,
    },
  });
}

async function resolveCashSessionId(
  userId: string,
  userRole: Role,
  cashSessionId?: string | null
) {
  let resolvedSessionId = cashSessionId ?? null;
  if (userRole === Role.CAISSIER) {
    const open = await prisma.cashSession.findFirst({
      where: { userId, status: "OPEN" },
    });
    if (!open) {
      throw new ApiError("VALIDATION_ERROR", "Ouvrez une session de caisse avant d'encaisser", 422);
    }
    resolvedSessionId = open.id;
  }

  if (resolvedSessionId) {
    const session = await prisma.cashSession.findUnique({ where: { id: resolvedSessionId } });
    if (!session || session.status !== "OPEN") {
      throw new ApiError("VALIDATION_ERROR", "Session de caisse invalide ou fermée", 422);
    }
  }

  return resolvedSessionId;
}

function serializePayment(payment: {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: unknown;
  flexpaieReference: string | null;
  flexpaieTransactionId: string | null;
  customerPhone: string | null;
  provider: string | null;
  completedAt: Date | null;
  createdAt: Date;
  invoice: { id: string; number: string; status: InvoiceStatus; totalTtc: unknown };
}) {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice.number,
    invoiceStatus: payment.invoice.status,
    method: payment.method,
    status: payment.status,
    amount: Number(payment.amount),
    flexpaieReference: payment.flexpaieReference,
    flexpaieTransactionId: payment.flexpaieTransactionId,
    customerPhone: payment.customerPhone,
    provider: payment.provider,
    completedAt: payment.completedAt,
    createdAt: payment.createdAt,
  };
}

function requirePaymentRole(role: Role) {
  if (role !== Role.ADMIN && role !== Role.MANAGER && role !== Role.CAISSIER) {
    throw new ApiError("FORBIDDEN", "Permissions insuffisantes pour encaisser", 403);
  }
}
