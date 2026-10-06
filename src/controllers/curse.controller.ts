import type { Request, Response } from 'express';
import * as curseService from '../services/curse.service.js';
import { created, noContent, ok } from '../utils/apiResponse.js';

type IdParams = { id: string };

export async function list(_req: Request, res: Response) {
  ok(res, await curseService.listCurses());
}

export async function getById(req: Request<IdParams>, res: Response) {
  ok(res, await curseService.getCurse(req.params.id));
}

export async function create(
  req: Request<object, unknown, curseService.CurseInput>,
  res: Response,
) {
  const { name, description, icon, durationHours, severity } = req.body;
  const curse = await curseService.createCurse({
    name,
    description,
    icon,
    durationHours,
    severity,
  });
  created(res, curse, `${req.baseUrl}/${curse.id as string}`);
}

export async function update(
  req: Request<IdParams, unknown, Partial<curseService.CurseInput>>,
  res: Response,
) {
  const { name, description, icon, durationHours, severity } = req.body;
  ok(
    res,
    await curseService.updateCurse(req.params.id, {
      name,
      description,
      icon,
      durationHours,
      severity,
    }),
  );
}

export async function remove(req: Request<IdParams>, res: Response) {
  await curseService.deleteCurse(req.params.id);
  noContent(res);
}
