import { InvoiceStatus, PointOfSaleType, prisma, Role, StockMovementType } from "@ges/database";
import { ApiError } from "@/lib/api-utils";
import { resolveAssetUrl } from "@/lib/assets";

export type InvoiceLineInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
};

function roundCdf(n: number) {
  return Math.round(n);
}

export function computeLineTotals(
  line: InvoiceLineInput & { taxRate: number }
) {
  const discountPercent = line.discountPercent ?? 0;
  const gross = line.quantity * line.unitPrice;
  const lineTotalHt = roundCdf(gross * (1 - discountPercent / 100));
  const lineTax = roundCdf((lineTotalHt * line.taxRate) / 100);
  const lineTotalTtc = lineTotalHt + lineTax;
  return { lineTotalHt, lineTax, lineTotalTtc, discountPercent };
}

function sumInvoiceTotals(
  lines: { lineTotalHt: number; lineTax: number; lineTotalTtc: number }[]
) {
  return lines.reduce(
    (acc, l) => ({
      subtotalHt: acc.subtotalHt + l.lineTotalHt,
      taxAmount: acc.taxAmount + l.lineTax,
      totalTtc: acc.totalTtc + l.lineTotalTtc,
    }),
    { subtotalHt: 0, taxAmount: 0, totalTtc: 0 }
  );
}

async function assertPointOfSaleAccess(userId: string, role: Role, pointOfSaleId: string) {
  if (role === Role.ADMIN || role === Role.MANAGER) return;

  const assignment = await prisma.userPointOfSale.findUnique({
    where: { userId_pointOfSaleId: { userId, pointOfSaleId } },
  });
  if (!assignment) {
    throw new ApiError("FORBIDDEN", "Vous n'êtes pas assigné à ce point de vente", 403);
  }
}

async function resolveLineProducts(lines: InvoiceLineInput[]) {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
  });
  if (products.length !== productIds.length) {
    throw new ApiError("NOT_FOUND", "Un ou plusieurs produits sont introuvables ou inactifs", 404);
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  return lines.map((line) => {
    const product = byId.get(line.productId)!;
    const taxRate = Number(product.taxRate);
    const totals = computeLineTotals({ ...line, taxRate });
    return {
      product,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      ...totals,
      taxRate,
    };
  });
}

function parseInvoiceSequence(number: string, prefix: string): number | null {
  const suffix = `${prefix}-`;
  if (!number.startsWith(suffix)) return null;
  const seq = parseInt(number.slice(suffix.length), 10);
  return Number.isNaN(seq) ? null : seq;
}

async function allocateInvoiceNumber(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], pointOfSaleId: string) {
  const pos = await tx.pointOfSale.findUniqueOrThrow({ where: { id: pointOfSaleId } });
  const prefix = pos.invoicePrefix;

  const latest = await tx.invoice.findFirst({
    where: {
      pointOfSaleId,
      number: { startsWith: `${prefix}-` },
    },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  let counterFloor = pos.invoiceNextNum;
  if (latest) {
    const maxSeq = parseInvoiceSequence(latest.number, prefix);
    if (maxSeq != null && maxSeq + 1 > counterFloor) {
      counterFloor = maxSeq + 1;
      await tx.pointOfSale.update({
        where: { id: pointOfSaleId },
        data: { invoiceNextNum: counterFloor },
      });
    }
  }

  const updated = await tx.pointOfSale.update({
    where: { id: pointOfSaleId },
    data: { invoiceNextNum: { increment: 1 } },
  });
  const num = updated.invoiceNextNum - 1;
  return `${prefix}-${String(num).padStart(4, "0")}`;
}

function serializeInvoiceSummary(invoice: {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerName: string | null;
  customerPhone: string | null;
  totalTtc: unknown;
  createdAt: Date;
  validatedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  pointOfSale: { id: string; code: string; name: string };
  createdBy: { id: string; name: string };
  _count?: { lines: number };
  lines?: unknown[];
}) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    totalTtc: Number(invoice.totalTtc),
    createdAt: invoice.createdAt,
    validatedAt: invoice.validatedAt,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    pointOfSale: invoice.pointOfSale,
    createdBy: invoice.createdBy,
    lineCount: invoice._count?.lines ?? (invoice.lines as unknown[] | undefined)?.length ?? 0,
  };
}

export async function listInvoices(params: {
  pointOfSaleId?: string;
  status?: InvoiceStatus;
  from?: Date;
  to?: Date;
  search?: string;
  page: number;
  limit: number;
}) {
  await expireStaleInvoices();

  const { pointOfSaleId, status, from, to, search, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(pointOfSaleId ? { pointOfSaleId } : {}),
    ...(status ? { status } : {}),
    ...(status === InvoiceStatus.PAID && (from || to)
      ? {
          paidAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
            not: null,
          },
        }
      : from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" as const } },
            { customerName: { contains: search, mode: "insensitive" as const } },
            { customerPhone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: status === InvoiceStatus.PAID ? { paidAt: "desc" } : { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    data: invoices.map(serializeInvoiceSummary),
    total,
    page,
    limit,
  };
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      pointOfSale: { select: { id: true, code: true, name: true, type: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      lines: {
        include: { product: { select: { id: true, sku: true, imageUrl: true } } },
        orderBy: { id: "asc" },
      },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!invoice) {
    throw new ApiError("NOT_FOUND", "Facture introuvable", 404);
  }

  return {
    ...serializeInvoiceSummary(invoice),
    subtotalHt: Number(invoice.subtotalHt),
    taxAmount: Number(invoice.taxAmount),
    discountAmount: Number(invoice.discountAmount),
    notes: invoice.notes,
    expiresAt: invoice.expiresAt,
    lines: invoice.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productSku: l.product.sku,
      productName: l.productName,
      productImageUrl: resolveAssetUrl(l.product.imageUrl),
      quantity: l.quantity,
      unitPrice: Number(l.unitPrice),
      taxRate: Number(l.taxRate),
      discountPercent: Number(l.discountPercent),
      lineTotalTtc: Number(l.lineTotalTtc),
    })),
    payments: invoice.payments.map((p) => ({
      id: p.id,
      method: p.method,
      status: p.status,
      amount: Number(p.amount),
      provider: p.provider,
      flexpaieReference: p.flexpaieReference,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    })),
  };
}

export async function cancelInvoice(params: {
  id: string;
  userId: string;
  userRole: Role;
  reason?: string;
}) {
  const { id, userId, userRole, reason } = params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!invoice) {
    throw new ApiError("NOT_FOUND", "Facture introuvable", 404);
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new ApiError("INVALID_STATUS", "Facture déjà annulée", 409);
  }
  if (invoice.status === InvoiceStatus.EXPIRED) {
    throw new ApiError("INVALID_STATUS", "Facture expirée — stock déjà libéré", 409);
  }
  if (invoice.status === InvoiceStatus.DRAFT) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: reason
          ? [invoice.notes, `Annulation brouillon: ${reason}`].filter(Boolean).join("\n")
          : invoice.notes,
      },
    });
  }

  if (invoice.status === InvoiceStatus.PAID && userRole !== Role.ADMIN) {
    throw new ApiError("FORBIDDEN", "Seul un administrateur peut annuler une facture payée", 403);
  }

  if (invoice.status === InvoiceStatus.PENDING_PAYMENT && userRole === Role.CAISSIER) {
    throw new ApiError("FORBIDDEN", "Permissions insuffisantes", 403);
  }

  return prisma.$transaction(async (tx) => {
    if (invoice.status === InvoiceStatus.PENDING_PAYMENT) {
      for (const line of invoice.lines) {
        const stock = await tx.productStock.findUnique({
          where: {
            productId_pointOfSaleId: {
              productId: line.productId,
              pointOfSaleId: invoice.pointOfSaleId,
            },
          },
        });
        if (!stock) continue;

        const releaseQty = Math.min(line.quantity, stock.reservedStock);
        if (releaseQty > 0) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { reservedStock: stock.reservedStock - releaseQty },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              pointOfSaleId: invoice.pointOfSaleId,
              type: StockMovementType.RELEASE_RESERVATION,
              quantity: releaseQty,
              reason: reason ?? `Annulation facture ${invoice.number}`,
              invoiceId: invoice.id,
              userId,
            },
          });
        }
      }
    }

    if (invoice.status === InvoiceStatus.PAID) {
      for (const line of invoice.lines) {
        let stock = await tx.productStock.findUnique({
          where: {
            productId_pointOfSaleId: {
              productId: line.productId,
              pointOfSaleId: invoice.pointOfSaleId,
            },
          },
        });
        if (!stock) {
          stock = await tx.productStock.create({
            data: {
              productId: line.productId,
              pointOfSaleId: invoice.pointOfSaleId,
              physicalStock: 0,
              reservedStock: 0,
            },
          });
        }
        await tx.productStock.update({
          where: { id: stock.id },
          data: { physicalStock: stock.physicalStock + line.quantity },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            pointOfSaleId: invoice.pointOfSaleId,
            type: StockMovementType.RETURN,
            quantity: line.quantity,
            reason: reason ?? `Retour — annulation facture ${invoice.number}`,
            invoiceId: invoice.id,
            userId,
          },
        });
      }
    }

    return tx.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: reason
          ? [invoice.notes, `Annulation: ${reason}`].filter(Boolean).join("\n")
          : invoice.notes,
      },
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    });
  });
}

export async function createInvoice(params: {
  pointOfSaleId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  lines: InvoiceLineInput[];
  userId: string;
  userRole: Role;
}) {
  const { pointOfSaleId, customerName, customerPhone, notes, lines, userId, userRole } = params;

  if (!lines.length) {
    throw new ApiError("VALIDATION_ERROR", "Au moins une ligne requise", 422);
  }

  const pos = await prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
  if (!pos || !pos.active) {
    throw new ApiError("NOT_FOUND", "Point de vente introuvable", 404);
  }
  if (pos.type !== PointOfSaleType.STORE) {
    throw new ApiError("VALIDATION_ERROR", "Les factures ne peuvent être émises que depuis un magasin (STORE)", 422);
  }

  await assertPointOfSaleAccess(userId, userRole, pointOfSaleId);

  const resolvedLines = await resolveLineProducts(lines);
  const totals = sumInvoiceTotals(resolvedLines);

  return prisma.$transaction(async (tx) => {
    const number = await allocateInvoiceNumber(tx, pointOfSaleId);

    const invoice = await tx.invoice.create({
      data: {
        number,
        status: InvoiceStatus.DRAFT,
        pointOfSaleId,
        customerName: customerName?.trim() || null,
        customerPhone: customerPhone?.trim() || null,
        notes: notes?.trim() || null,
        createdById: userId,
        subtotalHt: totals.subtotalHt,
        taxAmount: totals.taxAmount,
        totalTtc: totals.totalTtc,
        lines: {
          create: resolvedLines.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            discountPercent: l.discountPercent,
            lineTotalHt: l.lineTotalHt,
            lineTax: l.lineTax,
            lineTotalTtc: l.lineTotalTtc,
          })),
        },
      },
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    });

    return serializeInvoiceSummary(invoice);
  });
}

export async function updateInvoice(
  id: string,
  params: {
    customerName?: string | null;
    customerPhone?: string | null;
    notes?: string | null;
    lines?: InvoiceLineInput[];
    userId: string;
    userRole: Role;
  }
) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new ApiError("NOT_FOUND", "Facture introuvable", 404);
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new ApiError("INVALID_STATUS", "Seuls les brouillons peuvent être modifiés", 409);
  }

  await assertPointOfSaleAccess(params.userId, params.userRole, invoice.pointOfSaleId);

  if (params.userRole === Role.FACTURANT && invoice.createdById !== params.userId) {
    throw new ApiError("FORBIDDEN", "Vous ne pouvez modifier que vos propres brouillons", 403);
  }

  const resolvedLines = params.lines ? await resolveLineProducts(params.lines) : null;
  const totals = resolvedLines ? sumInvoiceTotals(resolvedLines) : null;

  await prisma.$transaction(async (tx) => {
    if (resolvedLines) {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLine.createMany({
        data: resolvedLines.map((l) => ({
          invoiceId: id,
          productId: l.product.id,
          productName: l.product.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          discountPercent: l.discountPercent,
          lineTotalHt: l.lineTotalHt,
          lineTax: l.lineTax,
          lineTotalTtc: l.lineTotalTtc,
        })),
      });
    }

    await tx.invoice.update({
      where: { id },
      data: {
        ...(params.customerName !== undefined
          ? { customerName: params.customerName?.trim() || null }
          : {}),
        ...(params.customerPhone !== undefined
          ? { customerPhone: params.customerPhone?.trim() || null }
          : {}),
        ...(params.notes !== undefined ? { notes: params.notes?.trim() || null } : {}),
        ...(totals
          ? {
              subtotalHt: totals.subtotalHt,
              taxAmount: totals.taxAmount,
              totalTtc: totals.totalTtc,
            }
          : {}),
      },
    });
  });

  return getInvoice(id);
}

export async function validateInvoice(id: string, userId: string, userRole: Role) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: true, pointOfSale: true },
  });

  if (!invoice) throw new ApiError("NOT_FOUND", "Facture introuvable", 404);
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new ApiError("INVALID_STATUS", "Seuls les brouillons peuvent être validés", 409);
  }

  await assertPointOfSaleAccess(userId, userRole, invoice.pointOfSaleId);

  if (userRole === Role.FACTURANT && invoice.createdById !== userId) {
    throw new ApiError("FORBIDDEN", "Vous ne pouvez valider que vos propres brouillons", 403);
  }

  const settings = await prisma.shopSettings.findFirst();
  const expiryH = settings?.invoiceExpiryH ?? 24;
  const expiresAt = new Date(Date.now() + expiryH * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    for (const line of invoice.lines) {
      let stock = await tx.productStock.findUnique({
        where: {
          productId_pointOfSaleId: {
            productId: line.productId,
            pointOfSaleId: invoice.pointOfSaleId,
          },
        },
      });

      const available = (stock?.physicalStock ?? 0) - (stock?.reservedStock ?? 0);
      if (available < line.quantity) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        throw new ApiError(
          "INSUFFICIENT_STOCK",
          `Stock insuffisant pour ${product?.name ?? line.productName} (disponible: ${available}, demandé: ${line.quantity})`,
          409,
          { productId: line.productId, available, requested: line.quantity }
        );
      }

      if (!stock) {
        stock = await tx.productStock.create({
          data: {
            productId: line.productId,
            pointOfSaleId: invoice.pointOfSaleId,
            physicalStock: 0,
            reservedStock: 0,
          },
        });
      }

      await tx.productStock.update({
        where: { id: stock.id },
        data: { reservedStock: stock.reservedStock + line.quantity },
      });

      await tx.stockMovement.create({
        data: {
          productId: line.productId,
          pointOfSaleId: invoice.pointOfSaleId,
          type: StockMovementType.RESERVATION,
          quantity: line.quantity,
          reason: `Réservation facture ${invoice.number}`,
          invoiceId: invoice.id,
          userId,
        },
      });
    }

    return tx.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PENDING_PAYMENT,
        validatedAt: new Date(),
        expiresAt,
      },
      include: {
        pointOfSale: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    });
  });
}

export async function expireStaleInvoices() {
  const now = new Date();
  const stale = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.PENDING_PAYMENT,
      expiresAt: { lte: now },
    },
    include: { lines: true },
  });

  if (!stale.length) return 0;

  for (const invoice of stale) {
    await prisma.$transaction(async (tx) => {
      for (const line of invoice.lines) {
        const stock = await tx.productStock.findUnique({
          where: {
            productId_pointOfSaleId: {
              productId: line.productId,
              pointOfSaleId: invoice.pointOfSaleId,
            },
          },
        });
        if (!stock) continue;

        const releaseQty = Math.min(line.quantity, stock.reservedStock);
        if (releaseQty > 0) {
          await tx.productStock.update({
            where: { id: stock.id },
            data: { reservedStock: stock.reservedStock - releaseQty },
          });
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              pointOfSaleId: invoice.pointOfSaleId,
              type: StockMovementType.RELEASE_RESERVATION,
              quantity: releaseQty,
              reason: `Expiration facture ${invoice.number}`,
              invoiceId: invoice.id,
            },
          });
        }
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.EXPIRED },
      });
    });
  }

  return stale.length;
}
