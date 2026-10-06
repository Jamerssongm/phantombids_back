import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import type { HouseTheme } from '../models/HauntHouse.js';
import * as houseService from '../services/house.service.js';
import { created, noContent, ok, paginated } from '../utils/apiResponse.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { queryString } from '../utils/query.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response) {
  const pagination = getPagination(req.query);
  const { items, total } = await houseService.listHouses(
    {
      // El validador de la ruta ya restringió theme al enum.
      theme: queryString(req.query.theme) as HouseTheme | undefined,
      name: queryString(req.query.name),
      code: queryString(req.query.code),
    },
    pagination,
  );
  paginated(res, items, buildMeta(total, pagination));
}

export async function getById(req: Request<IdParams>, res: Response) {
  ok(res, await houseService.getHouseDetail(req.params.id));
}

export async function create(
  req: Request<object, unknown, houseService.HouseInput>,
  res: Response,
) {
  const { name, code, theme, description, coverImageUrl } = req.body;
  const house = await houseService.createHouse(getAuthUser(req), {
    name,
    code,
    theme,
    description,
    coverImageUrl,
  });
  created(res, house, `${req.baseUrl}/${house.id as string}`);
}

export async function update(
  req: Request<IdParams, unknown, Partial<houseService.HouseInput>>,
  res: Response,
) {
  const { name, code, theme, description, coverImageUrl } = req.body;
  ok(
    res,
    await houseService.updateHouse(req.params.id, getAuthUser(req), {
      name,
      code,
      theme,
      description,
      coverImageUrl,
    }),
  );
}

export async function remove(req: Request<IdParams>, res: Response) {
  await houseService.deleteHouse(req.params.id, getAuthUser(req));
  noContent(res);
}
