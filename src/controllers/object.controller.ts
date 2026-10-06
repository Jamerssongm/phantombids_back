import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import * as objectService from '../services/object.service.js';
import { created, noContent, ok, paginated } from '../utils/apiResponse.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { queryString } from '../utils/query.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response) {
  const pagination = getPagination(req.query);
  const { items, total } = await objectService.listObjects(
    { house: queryString(req.query.house), curse: queryString(req.query.curse) },
    pagination,
  );
  paginated(res, items, buildMeta(total, pagination));
}

export async function getById(req: Request<IdParams>, res: Response) {
  ok(res, await objectService.getObject(req.params.id));
}

export async function create(
  req: Request<object, unknown, objectService.CreateObjectInput>,
  res: Response,
) {
  const { name, imageUrl, house, curse, minBid, maxBid } = req.body;
  const object = await objectService.createObject(getAuthUser(req), {
    name,
    imageUrl,
    house,
    curse,
    minBid,
    maxBid,
  });
  created(res, object, `${req.baseUrl}/${object.id as string}`);
}

export async function update(
  req: Request<IdParams, unknown, objectService.UpdateObjectInput>,
  res: Response,
) {
  const { name, imageUrl, curse, minBid, maxBid } = req.body;
  ok(
    res,
    await objectService.updateObject(req.params.id, getAuthUser(req), {
      name,
      imageUrl,
      curse,
      minBid,
      maxBid,
    }),
  );
}

export async function remove(req: Request<IdParams>, res: Response) {
  await objectService.deleteObject(req.params.id, getAuthUser(req));
  noContent(res);
}
