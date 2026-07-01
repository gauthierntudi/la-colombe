import { InvoiceStatus, prisma, StockMovementType } from "@ges/database";

const IN_TYPES: StockMovementType[] = [
  StockMovementType.PURCHASE_IN,
  StockMovementType.TRANSFER_IN,
  StockMovementType.RETURN,
  StockMovementType.ADJUSTMENT,
];

const OUT_TYPES: StockMovementType[] = [
  StockMovementType.SALE_OUT,
  StockMovementType.TRANSFER_OUT,
  StockMovementType.ADJUSTMENT,
];

export async function getSalesReport(params: {
  pointOfSaleId?: string;
  productId?: string;
  from: Date;
  to: Date;
  groupBy: "day" | "month";
}) {
  const { pointOfSaleId, productId, from, to, groupBy } = params;

  if (productId) {
    const lines = await prisma.invoiceLine.findMany({
      where: {
        productId,
        invoice: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: from, lte: to },
          ...(pointOfSaleId ? { pointOfSaleId } : {}),
        },
      },
      select: {
        lineTotalTtc: true,
        invoice: { select: { paidAt: true, id: true } },
      },
      orderBy: { invoice: { paidAt: "asc" } },
    });

    const buckets = new Map<string, { date: string; total: number; invoiceIds: Set<string> }>();

    for (const line of lines) {
      const paidAt = line.invoice.paidAt;
      if (!paidAt) continue;
      const key =
        groupBy === "month"
          ? paidAt.toISOString().slice(0, 7)
          : paidAt.toISOString().slice(0, 10);
      const existing = buckets.get(key) ?? { date: key, total: 0, invoiceIds: new Set() };
      existing.total += Number(line.lineTotalTtc);
      existing.invoiceIds.add(line.invoice.id);
      buckets.set(key, existing);
    }

    const data = Array.from(buckets.values())
      .map(({ date, total, invoiceIds }) => ({
        date,
        total,
        count: invoiceIds.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const summary = {
      totalSales: data.reduce((s, d) => s + d.total, 0),
      invoiceCount: data.reduce((s, d) => s + d.count, 0),
    };

    return { data, summary };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.PAID,
      paidAt: { gte: from, lte: to },
      ...(pointOfSaleId ? { pointOfSaleId } : {}),
    },
    select: { paidAt: true, totalTtc: true },
    orderBy: { paidAt: "asc" },
  });

  const buckets = new Map<string, { date: string; total: number; count: number }>();

  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const key =
      groupBy === "month"
        ? inv.paidAt.toISOString().slice(0, 7)
        : inv.paidAt.toISOString().slice(0, 10);
    const existing = buckets.get(key) ?? { date: key, total: 0, count: 0 };
    existing.total += Number(inv.totalTtc);
    existing.count += 1;
    buckets.set(key, existing);
  }

  const data = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  const summary = {
    totalSales: data.reduce((s, d) => s + d.total, 0),
    invoiceCount: data.reduce((s, d) => s + d.count, 0),
  };

  return { data, summary };
}

export async function getTopProductsReport(params: {
  pointOfSaleId?: string;
  productId?: string;
  from: Date;
  to: Date;
  limit?: number;
}) {
  const { pointOfSaleId, productId, from, to, limit = 10 } = params;

  const lines = await prisma.invoiceLine.findMany({
    where: {
      ...(productId ? { productId } : {}),
      invoice: {
        status: InvoiceStatus.PAID,
        paidAt: { gte: from, lte: to },
        ...(pointOfSaleId ? { pointOfSaleId } : {}),
      },
    },
    select: {
      productId: true,
      productName: true,
      quantity: true,
      lineTotalTtc: true,
    },
  });

  const byProduct = new Map<
    string,
    { productId: string; name: string; quantity: number; revenue: number }
  >();

  for (const line of lines) {
    const existing = byProduct.get(line.productId) ?? {
      productId: line.productId,
      name: line.productName,
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += line.quantity;
    existing.revenue += Number(line.lineTotalTtc);
    byProduct.set(line.productId, existing);
  }

  return Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getSalesLinesReport(params: {
  pointOfSaleId?: string;
  productId?: string;
  status?: InvoiceStatus;
  from: Date;
  to: Date;
  page: number;
  limit: number;
}) {
  const { pointOfSaleId, productId, status, from, to, page, limit } = params;
  const skip = (page - 1) * limit;

  const invoiceWhere = {
    ...(pointOfSaleId ? { pointOfSaleId } : {}),
    ...(status ? { status } : {}),
    ...(status === InvoiceStatus.PAID
      ? { paidAt: { gte: from, lte: to } }
      : { createdAt: { gte: from, lte: to } }),
  };

  const where = {
    ...(productId ? { productId } : {}),
    invoice: invoiceWhere,
  };

  const [lines, total, aggregates] = await Promise.all([
    prisma.invoiceLine.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            status: true,
            customerName: true,
            customerPhone: true,
            paidAt: true,
            createdAt: true,
            pointOfSale: { select: { id: true, code: true, name: true } },
          },
        },
        product: { select: { sku: true } },
      },
      orderBy: [{ invoice: { paidAt: "desc" } }, { invoice: { createdAt: "desc" } }],
      skip,
      take: limit,
    }),
    prisma.invoiceLine.count({ where }),
    prisma.invoiceLine.aggregate({
      where,
      _sum: { quantity: true, lineTotalTtc: true },
    }),
  ]);

  return {
    data: lines.map((line) => ({
      id: line.id,
      invoiceId: line.invoice.id,
      invoiceNumber: line.invoice.number,
      invoiceStatus: line.invoice.status,
      paidAt: line.invoice.paidAt,
      createdAt: line.invoice.createdAt,
      pointOfSale: line.invoice.pointOfSale,
      productId: line.productId,
      productName: line.productName,
      productSku: line.product.sku,
      quantity: line.quantity,
      lineTotalTtc: Number(line.lineTotalTtc),
      customerName: line.invoice.customerName,
      customerPhone: line.invoice.customerPhone,
    })),
    total,
    page,
    limit,
    summary: {
      totalQuantity: aggregates._sum.quantity ?? 0,
      totalAmount: Number(aggregates._sum.lineTotalTtc ?? 0),
    },
  };
}

export async function getInventoryValuation(pointOfSaleId?: string) {
  const stocks = await prisma.productStock.findMany({
    where: pointOfSaleId ? { pointOfSaleId } : undefined,
    include: {
      product: { select: { unitPrice: true, active: true } },
      pointOfSale: { select: { id: true, code: true, name: true } },
    },
  });

  const bySite = new Map<
    string,
    { siteId: string; code: string; name: string; units: number; value: number }
  >();

  for (const s of stocks) {
    if (!s.product.active) continue;
    const available = s.physicalStock - s.reservedStock;
    const value = available * Number(s.product.unitPrice);
    const existing = bySite.get(s.pointOfSaleId) ?? {
      siteId: s.pointOfSaleId,
      code: s.pointOfSale.code,
      name: s.pointOfSale.name,
      units: 0,
      value: 0,
    };
    existing.units += available;
    existing.value += value;
    bySite.set(s.pointOfSaleId, existing);
  }

  const sites = Array.from(bySite.values());
  return {
    sites,
    totalValue: sites.reduce((sum, s) => sum + s.value, 0),
    totalUnits: sites.reduce((sum, s) => sum + s.units, 0),
  };
}

export async function getStockActivityReport(year?: number) {
  const y = year ?? new Date().getFullYear();
  const from = new Date(`${y}-01-01T00:00:00.000Z`);
  const to = new Date(`${y}-12-31T23:59:59.999Z`);

  const movements = await prisma.stockMovement.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { type: true, quantity: true, createdAt: true },
  });

  const months = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
  ];

  const buckets = months.map((month) => ({ month, entrees: 0, sorties: 0 }));

  for (const m of movements) {
    const idx = m.createdAt.getMonth();
    const qty = Math.abs(m.quantity);
    if (IN_TYPES.includes(m.type) && m.quantity > 0) {
      buckets[idx].entrees += qty;
    } else if (OUT_TYPES.includes(m.type) && m.quantity < 0) {
      buckets[idx].sorties += qty;
    } else if (m.type === StockMovementType.SALE_OUT) {
      buckets[idx].sorties += qty;
    } else if (m.quantity > 0) {
      buckets[idx].entrees += qty;
    } else if (m.quantity < 0) {
      buckets[idx].sorties += qty;
    }
  }

  return buckets;
}

export async function getDashboardSummary(params?: {
  pointOfSaleId?: string;
  from?: Date;
  to?: Date;
}) {
  const to = params?.to ?? new Date();
  const from =
    params?.from ??
    (() => {
      const d = new Date(to);
      d.setHours(0, 0, 0, 0);
      return d;
    })();

  const invoiceWhere = {
    status: InvoiceStatus.PAID,
    paidAt: { gte: from, lte: to },
    ...(params?.pointOfSaleId ? { pointOfSaleId: params.pointOfSaleId } : {}),
  };

  const lowStockQuery = params?.pointOfSaleId
    ? prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM "ProductStock" ps
        JOIN "Product" p ON p.id = ps."productId"
        WHERE p.active = true
          AND ps."pointOfSaleId" = ${params.pointOfSaleId}
          AND (ps."physicalStock" - ps."reservedStock") < p."minStockLevel"
      `
    : prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint as count
        FROM "ProductStock" ps
        JOIN "Product" p ON p.id = ps."productId"
        WHERE p.active = true
          AND (ps."physicalStock" - ps."reservedStock") < p."minStockLevel"
      `;

  const [paidInvoices, products, sites, lowStockRows] = await Promise.all([
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: { totalTtc: true },
      _count: true,
    }),
    prisma.product.count({ where: { active: true } }),
    params?.pointOfSaleId
      ? Promise.resolve(1)
      : prisma.pointOfSale.count({ where: { active: true } }),
    lowStockQuery,
  ]);

  const valuation = await getInventoryValuation(params?.pointOfSaleId);

  return {
    salesLast30Days: Number(paidInvoices._sum.totalTtc ?? 0),
    invoicesLast30Days: paidInvoices._count,
    activeProducts: products,
    activeSites: sites,
    lowStockAlerts: Number(lowStockRows[0]?.count ?? 0),
    totalStockValue: valuation.totalValue,
  };
}

export type LowStockAlert = {
  productId: string;
  sku: string;
  name: string;
  pointOfSaleId: string;
  siteCode: string;
  siteName: string;
  availableStock: number;
  minStockLevel: number;
  deficit: number;
};

export async function getLowStockAlerts(params: {
  pointOfSaleId?: string;
  limit?: number;
} = {}): Promise<LowStockAlert[]> {
  const limit = params.limit ?? 20;

  const stocks = await prisma.productStock.findMany({
    where: {
      ...(params.pointOfSaleId ? { pointOfSaleId: params.pointOfSaleId } : {}),
      product: { active: true },
    },
    include: {
      product: { select: { sku: true, name: true, minStockLevel: true } },
      pointOfSale: { select: { id: true, code: true, name: true } },
    },
  });

  return stocks
    .map((s) => {
      const availableStock = s.physicalStock - s.reservedStock;
      const minStockLevel = s.product.minStockLevel;
      return {
        productId: s.productId,
        sku: s.product.sku,
        name: s.product.name,
        pointOfSaleId: s.pointOfSaleId,
        siteCode: s.pointOfSale.code,
        siteName: s.pointOfSale.name,
        availableStock,
        minStockLevel,
        deficit: minStockLevel - availableStock,
      };
    })
    .filter((r) => r.availableStock < r.minStockLevel)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, limit);
}
