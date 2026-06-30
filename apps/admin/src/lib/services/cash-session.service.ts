import {
  CashSessionStatus,
  PointOfSaleType,
  prisma,
  Role,
} from "@ges/database";
import { ApiError } from "@/lib/api-utils";
import { resolveAssetUrl } from "@/lib/assets";

async function assertPosAccess(userId: string, role: Role, pointOfSaleId: string) {
  if (role === Role.ADMIN || role === Role.MANAGER) return;

  const assignment = await prisma.userPointOfSale.findUnique({
    where: { userId_pointOfSaleId: { userId, pointOfSaleId } },
  });
  if (!assignment) {
    throw new ApiError("FORBIDDEN", "Vous n'êtes pas assigné à ce point de vente", 403);
  }
}

function serializeSession(session: {
  id: string;
  status: CashSessionStatus;
  openingCash: unknown;
  closingCash: unknown | null;
  expectedCash: unknown | null;
  cashVariance: unknown | null;
  totalMobileMoney: unknown;
  totalSales: unknown;
  invoiceCount: number;
  openedAt: Date;
  closedAt: Date | null;
  notes: string | null;
  user: { id: string; name: string; avatarUrl?: string | null };
  pointOfSale: { id: string; code: string; name: string };
}) {
  return {
    id: session.id,
    status: session.status,
    openingCash: Number(session.openingCash),
    closingCash: session.closingCash != null ? Number(session.closingCash) : null,
    expectedCash: session.expectedCash != null ? Number(session.expectedCash) : null,
    cashVariance: session.cashVariance != null ? Number(session.cashVariance) : null,
    totalMobileMoney: Number(session.totalMobileMoney),
    totalSales: Number(session.totalSales),
    invoiceCount: session.invoiceCount,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    notes: session.notes,
    user: {
      id: session.user.id,
      name: session.user.name,
      avatarUrl: resolveAssetUrl(session.user.avatarUrl),
    },
    pointOfSale: session.pointOfSale,
  };
}

export async function listCashSessions(params: {
  pointOfSaleId?: string;
  status?: CashSessionStatus;
  from?: Date;
  to?: Date;
  search?: string;
  page: number;
  limit: number;
}) {
  const { pointOfSaleId, status, from, to, search, page, limit } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(pointOfSaleId ? { pointOfSaleId } : {}),
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          openedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          user: {
            name: { contains: search, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  const [sessions, total, openCount, salesAgg] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        pointOfSale: { select: { id: true, code: true, name: true } },
      },
      orderBy: { openedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.cashSession.count({ where }),
    prisma.cashSession.count({ where: { ...where, status: CashSessionStatus.OPEN } }),
    prisma.cashSession.aggregate({ where, _sum: { totalSales: true } }),
  ]);

  return {
    data: sessions.map(serializeSession),
    total,
    page,
    limit,
    summary: {
      openCount,
      closedCount: total - openCount,
      totalSales: Number(salesAgg._sum.totalSales ?? 0),
    },
  };
}

export async function openCashSession(params: {
  userId: string;
  userRole: Role;
  pointOfSaleId: string;
  openingCash?: number;
}) {
  const { userId, userRole, pointOfSaleId, openingCash = 0 } = params;

  const pos = await prisma.pointOfSale.findUnique({ where: { id: pointOfSaleId } });
  if (!pos || !pos.active) {
    throw new ApiError("NOT_FOUND", "Point de vente introuvable", 404);
  }
  if (pos.type !== PointOfSaleType.STORE) {
    throw new ApiError("VALIDATION_ERROR", "La caisse n'est ouverte que sur un magasin (STORE)", 422);
  }

  await assertPosAccess(userId, userRole, pointOfSaleId);

  const existing = await prisma.cashSession.findFirst({
    where: { userId, pointOfSaleId, status: CashSessionStatus.OPEN },
  });
  if (existing) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Une session est déjà ouverte pour ce caissier sur ce site",
      409
    );
  }

  const session = await prisma.cashSession.create({
    data: {
      userId,
      pointOfSaleId,
      openingCash,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      pointOfSale: { select: { id: true, code: true, name: true } },
    },
  });

  return serializeSession(session);
}

export async function closeCashSession(params: {
  sessionId: string;
  userId: string;
  userRole: Role;
  closingCash: number;
  notes?: string;
}) {
  const { sessionId, userId, userRole, closingCash, notes } = params;

  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: { payments: { where: { status: "COMPLETED" } } },
  });

  if (!session) {
    throw new ApiError("NOT_FOUND", "Session introuvable", 404);
  }
  if (session.status !== CashSessionStatus.OPEN) {
    throw new ApiError("INVALID_STATUS", "Session déjà clôturée", 409);
  }

  if (userRole === Role.CAISSIER && session.userId !== userId) {
    throw new ApiError("FORBIDDEN", "Vous ne pouvez clôturer que votre propre session", 403);
  }

  const cashCollected = session.payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + Number(p.amount), 0);

  const expectedCash = Number(session.openingCash) + cashCollected;
  const cashVariance = closingCash - expectedCash;

  const updated = await prisma.cashSession.update({
    where: { id: sessionId },
    data: {
      status: CashSessionStatus.CLOSED,
      closingCash,
      expectedCash,
      cashVariance,
      closedAt: new Date(),
      notes: notes?.trim() || null,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      pointOfSale: { select: { id: true, code: true, name: true } },
    },
  });

  return serializeSession(updated);
}

export async function getCashSessionSummary(sessionId: string) {
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      pointOfSale: { select: { id: true, code: true, name: true } },
      payments: {
        where: { status: "COMPLETED" },
        include: { invoice: { select: { number: true } } },
      },
    },
  });

  if (!session) {
    throw new ApiError("NOT_FOUND", "Session introuvable", 404);
  }

  const cashPayments = session.payments.filter((p) => p.method === "CASH");
  const mmPayments = session.payments.filter((p) => p.method === "MOBILE_MONEY");

  return {
    ...serializeSession(session),
    payments: session.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
      invoiceNumber: p.invoice.number,
      completedAt: p.completedAt,
    })),
    summary: {
      cashCount: cashPayments.length,
      cashTotal: cashPayments.reduce((s, p) => s + Number(p.amount), 0),
      mobileMoneyCount: mmPayments.length,
      mobileMoneyTotal: mmPayments.reduce((s, p) => s + Number(p.amount), 0),
    },
  };
}

export async function getOpenSessionForUser(userId: string, pointOfSaleId?: string) {
  const session = await prisma.cashSession.findFirst({
    where: {
      userId,
      status: CashSessionStatus.OPEN,
      ...(pointOfSaleId ? { pointOfSaleId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      pointOfSale: { select: { id: true, code: true, name: true } },
    },
  });
  return session ? serializeSession(session) : null;
}
