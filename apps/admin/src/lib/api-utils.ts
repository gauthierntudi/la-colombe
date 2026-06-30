import { Role } from "@ges/database";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ERROR_CODES = {
  UNAUTHORIZED: { status: 401, code: "UNAUTHORIZED" },
  FORBIDDEN: { status: 403, code: "FORBIDDEN" },
  NOT_FOUND: { status: 404, code: "NOT_FOUND" },
  VALIDATION_ERROR: { status: 422, code: "VALIDATION_ERROR" },
  INSUFFICIENT_STOCK: { status: 409, code: "INSUFFICIENT_STOCK" },
} as const;

export function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }

  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur" } },
    { status: 500 }
  );
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 4,
  MANAGER: 3,
  FACTURANT: 2,
  CAISSIER: 1,
};

export function hasMinRole(userRole: Role, required: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}

export function formatCdf(amount: number | bigint): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return new Intl.NumberFormat("fr-CD", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(n);
}
