import type { Response } from 'express';
import type { PaginationMeta } from './pagination.js';

export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** 200 (o el código indicado) con { success: true, data }. */
export function ok<T>(res: Response, data: T, statusCode = 200): Response<SuccessBody<T>> {
  return res.status(statusCode).json({ success: true, data });
}

/**
 * 201 con { success: true, data } para recursos recién creados. Con `location`
 * agrega el header Location apuntando al recurso nuevo.
 */
export function created<T>(res: Response, data: T, location?: string): Response<SuccessBody<T>> {
  if (location) res.location(location);
  return ok(res, data, 201);
}

/** 200 con { success: true, data, meta } para listados paginados. */
export function paginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
): Response<SuccessBody<T[]>> {
  return res.status(200).json({ success: true, data, meta });
}

/** 204 sin cuerpo, para borrados. */
export function noContent(res: Response): Response {
  return res.status(204).end();
}
