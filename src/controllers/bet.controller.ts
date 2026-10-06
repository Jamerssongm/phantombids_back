import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import * as betService from '../services/bet.service.js';
import { created, noContent, ok, paginated } from '../utils/apiResponse.js';
import { buildMeta, getPagination } from '../utils/pagination.js';

type IdParams = { id: string };

export async function place(
  req: Request<object, unknown, betService.PlaceBetInput>,
  res: Response,
) {
  const { auction, targetAlias, chips } = req.body;
  const bet = await betService.placeBet(getAuthUser(req), { auction, targetAlias, chips });
  created(res, bet, `${req.baseUrl}/${bet.id as string}`);
}

export async function mine(req: Request, res: Response) {
  const pagination = getPagination(req.query);
  const { items, total } = await betService.listMyBets(getAuthUser(req), pagination);
  paginated(res, items, buildMeta(total, pagination));
}

export async function getById(req: Request<IdParams>, res: Response) {
  ok(res, await betService.getBet(req.params.id, getAuthUser(req)));
}

export async function cancel(req: Request<IdParams>, res: Response) {
  await betService.cancelBet(req.params.id, getAuthUser(req));
  noContent(res);
}
