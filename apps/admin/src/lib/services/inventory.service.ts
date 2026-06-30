import { prisma, StockMovementType } from "@ges/database";
import { ApiError } from "@/lib/api-utils";

export async function listInventory(
  pointOfSaleId: string,
  search?: string,
  belowMinStock?: boolean
) {
  const pos = await prisma.pointOfSale.findUnique({
    where: { id: pointOfSaleId },
  });
  if (!pos) {
    throw new ApiError("NOT_FOUND", "Point de vente introuvable", 404);
  }

  const stocks = await prisma.productStock.findMany({
    where: {
      pointOfSaleId,
      product: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
    },
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { product: { name: "asc" } },
  });

  const rows = stocks.map((s) => ({
    productId: s.productId,
    pointOfSaleId: s.pointOfSaleId,
    sku: s.product.sku,
    name: s.product.name,
    category: s.product.category?.name ?? null,
    unitPrice: Number(s.product.unitPrice),
    minStockLevel: s.product.minStockLevel,
    physicalStock: s.physicalStock,
    reservedStock: s.reservedStock,
    availableStock: s.physicalStock - s.reservedStock,
    belowMin: s.physicalStock - s.reservedStock < s.product.minStockLevel,
  }));

  return belowMinStock ? rows.filter((r) => r.belowMin) : rows;
}

export async function adjustStock(params: {
  pointOfSaleId: string;
  productId: string;
  quantity: number;
  type: StockMovementType;
  reason: string;
  userId: string;
}) {
  const { pointOfSaleId, productId, quantity, type, reason, userId } = params;

  return prisma.$transaction(async (tx) => {
    let stock = await tx.productStock.findUnique({
      where: { productId_pointOfSaleId: { productId, pointOfSaleId } },
    });

    if (!stock) {
      stock = await tx.productStock.create({
        data: { productId, pointOfSaleId, physicalStock: 0, reservedStock: 0 },
      });
    }

    const newPhysical = stock.physicalStock + quantity;
    if (newPhysical < 0) {
      throw new ApiError(
        "INSUFFICIENT_STOCK",
        `Stock insuffisant (disponible: ${stock.physicalStock - stock.reservedStock})`,
        409,
        { available: stock.physicalStock - stock.reservedStock, requested: Math.abs(quantity) }
      );
    }

    await tx.productStock.update({
      where: { id: stock.id },
      data: { physicalStock: newPhysical },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        pointOfSaleId,
        type,
        quantity,
        reason,
        userId,
      },
    });

    return movement;
  });
}

export async function receiveStock(params: {
  pointOfSaleId: string;
  productId: string;
  quantity: number;
  reason: string;
  userId: string;
}) {
  if (params.quantity <= 0) {
    throw new ApiError("VALIDATION_ERROR", "La quantité doit être positive", 422);
  }

  return adjustStock({
    ...params,
    quantity: params.quantity,
    type: StockMovementType.PURCHASE_IN,
  });
}

function generateTransferReference() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TRF-${date}-${suffix}`;
}

export async function transferStock(params: {
  fromId: string;
  toId: string;
  lines: { productId: string; quantity: number }[];
  notes?: string;
  userId: string;
}) {
  const { fromId, toId, lines, notes, userId } = params;

  if (fromId === toId) {
    throw new ApiError("VALIDATION_ERROR", "Source et destination doivent être différentes", 422);
  }
  if (!lines.length) {
    throw new ApiError("VALIDATION_ERROR", "Au moins une ligne de transfert requise", 422);
  }

  const [from, to] = await Promise.all([
    prisma.pointOfSale.findUnique({ where: { id: fromId } }),
    prisma.pointOfSale.findUnique({ where: { id: toId } }),
  ]);

  if (!from) throw new ApiError("NOT_FOUND", "Site source introuvable", 404);
  if (!to) throw new ApiError("NOT_FOUND", "Site destination introuvable", 404);

  for (const line of lines) {
    if (line.quantity <= 0) {
      throw new ApiError("VALIDATION_ERROR", "Les quantités doivent être positives", 422);
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const stock = await tx.productStock.findUnique({
        where: { productId_pointOfSaleId: { productId: line.productId, pointOfSaleId: fromId } },
      });
      const available = (stock?.physicalStock ?? 0) - (stock?.reservedStock ?? 0);
      if (available < line.quantity) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        throw new ApiError(
          "INSUFFICIENT_STOCK",
          `Stock insuffisant pour ${product?.name ?? line.productId} (disponible: ${available})`,
          409,
          { productId: line.productId, available, requested: line.quantity }
        );
      }
    }

    const transfer = await tx.stockTransfer.create({
      data: {
        reference: generateTransferReference(),
        fromId,
        toId,
        notes: notes ?? null,
        createdById: userId,
        completedAt: new Date(),
        lines: {
          create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        },
      },
      include: { lines: true },
    });

    for (const line of lines) {
      const fromStock = await tx.productStock.findUnique({
        where: { productId_pointOfSaleId: { productId: line.productId, pointOfSaleId: fromId } },
      });
      if (!fromStock) continue;

      await tx.productStock.update({
        where: { id: fromStock.id },
        data: { physicalStock: fromStock.physicalStock - line.quantity },
      });

      let toStock = await tx.productStock.findUnique({
        where: { productId_pointOfSaleId: { productId: line.productId, pointOfSaleId: toId } },
      });
      if (!toStock) {
        toStock = await tx.productStock.create({
          data: { productId: line.productId, pointOfSaleId: toId, physicalStock: 0, reservedStock: 0 },
        });
      }
      await tx.productStock.update({
        where: { id: toStock.id },
        data: { physicalStock: toStock.physicalStock + line.quantity },
      });

      const reason = notes ?? `Transfert ${transfer.reference}`;

      await tx.stockMovement.createMany({
        data: [
          {
            productId: line.productId,
            pointOfSaleId: fromId,
            type: StockMovementType.TRANSFER_OUT,
            quantity: -line.quantity,
            reason,
            transferId: transfer.id,
            userId,
          },
          {
            productId: line.productId,
            pointOfSaleId: toId,
            type: StockMovementType.TRANSFER_IN,
            quantity: line.quantity,
            reason,
            transferId: transfer.id,
            userId,
          },
        ],
      });
    }

    return transfer;
  });
}

export async function listMovements(params: {
  pointOfSaleId?: string;
  productId?: string;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}) {
  const { pointOfSaleId, productId, type, from, to, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(pointOfSaleId ? { pointOfSaleId } : {}),
    ...(productId ? { productId } : {}),
    ...(type ? { type } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { sku: true, name: true } },
        pointOfSale: { select: { code: true, name: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    data: movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      createdAt: m.createdAt,
      product: m.product,
      pointOfSale: m.pointOfSale,
      user: m.user,
      transferId: m.transferId,
      invoiceId: m.invoiceId,
    })),
    total,
    page,
    limit,
  };
}
