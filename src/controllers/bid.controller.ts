import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import * as bidService from '../services/bid.service.js';
import { created, ok } from '../utils/apiResponse.js';

type AuctionParams = { id: string };

/** Confirmación con la puja propia y nada más: ni conteos ni datos de otras pujas. */
export async function place(
  req: Request<AuctionParams, unknown, { amount: number }>,
  res: Response,
) {
  const bid = await bidService.placeBid(req.params.id, getAuthUser(req), req.body.amount);
  created(
    res,
    { id: bid.id as string, auction: req.params.id, amount: bid.amount, createdAt: bid.createdAt },
    `${req.baseUrl}/mine`,
  );
}

export async function mine(req: Request<AuctionParams>, res: Response) {
  ok(res, await bidService.getMyBid(req.params.id, getAuthUser(req)));
}

export async function revealed(req: Request<AuctionParams>, res: Response) {
  ok(res, await bidService.listRevealedBids(req.params.id));
}

export async function participants(req: Request<AuctionParams>, res: Response) {
  ok(res, await bidService.listParticipants(req.params.id));
}
