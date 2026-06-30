export const DEFAULT_PAGE_SIZE = 20;

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number = DEFAULT_PAGE_SIZE
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number = DEFAULT_PAGE_SIZE
): { data: T[]; meta: PaginationMeta } {
  const total = items.length;
  const meta = buildPaginationMeta(total, page, limit);
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta,
  };
}

export const EMPTY_PAGINATION: PaginationMeta = {
  total: 0,
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  totalPages: 1,
};
