import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import type { AuctionStatus } from '../models/Auction.js';
import * as auctionService from '../services/auction.service.js';
import { created, noContent, ok, paginated } from '../utils/apiResponse.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { queryString } from '../utils/query.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response) {
  const pagination = getPagination(req.query);
  const { items, total } = await auctionService.listAuctions(
    {
      // El validador de la ruta ya restringió status al enum.
      status: queryString(req.query.status) as AuctionStatus | undefined,
      house: queryString(req.query.house),
      object: queryString(req.query.object),
    },
    pagination,
  );
  paginated(res, items, buildMeta(total, pagination));
}

/** Pública; si hay sesión (autenticarOpcional) incluye la puja propia. */
export async function getById(req: Request<IdParams>, res: Response) {
  ok(res, await auctionService.getAuctionForViewer(req.params.id, req.user));
}

export async function create(
  req: Request<object, unknown, auctionService.CreateAuctionInput>,
  res: Response,
) {
  const { object, opensAt, closesAt } = req.body;
  const auction = await auctionService.createAuction(getAuthUser(req), {
    object,
    opensAt,
    closesAt,
  });
  created(res, auction, `${req.baseUrl}/${auction.id as string}`);
}

export async function update(
  req: Request<IdParams, unknown, auctionService.UpdateAuctionInput>,
  res: Response,
) {
  const { opensAt, closesAt } = req.body;
  ok(
    res,
    await auctionService.updateAuction(req.params.id, getAuthUser(req), { opensAt, closesAt }),
  );
}

export async function remove(req: Request<IdParams>, res: Response) {
  await auctionService.deleteAuction(req.params.id, getAuthUser(req));
  noContent(res);
}
