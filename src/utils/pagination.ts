export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/**
 * Lee page y limit del query string. Valores ausentes o inválidos caen al default;
 * limit se recorta a MAX_LIMIT en vez de rechazarse.
 *
 *   const { skip, limit, ...p } = getPagination(req.query);
 *   const [items, total] = await Promise.all([Model.find().skip(skip).limit(limit), Model.countDocuments()]);
 *   paginated(res, items, buildMeta(total, p));
 */
export function getPagination(query: { page?: unknown; limit?: unknown }): Pagination {
  const page = positiveInt(query.page, DEFAULT_PAGE);
  const limit = Math.min(positiveInt(query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(
  total: number,
  { page, limit }: Pick<Pagination, 'page' | 'limit'>,
): PaginationMeta {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
