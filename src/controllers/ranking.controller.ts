import type { Request, Response } from 'express';
import * as rankingService from '../services/ranking.service.js';
import { paginated } from '../utils/apiResponse.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { queryString } from '../utils/query.js';

export async function get(req: Request, res: Response) {
  const pagination = getPagination(req.query);
  // El validador de la ruta ya exigió type dentro del enum.
  const type = queryString(req.query.type) as rankingService.RankingType;
  const { items, total } = await rankingService.getRanking(type, pagination);
  paginated(res, items, buildMeta(total, pagination));
}
