import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import type { UserRole } from '../models/User.js';
import * as userService from '../services/user.service.js';
import { noContent, ok, paginated } from '../utils/apiResponse.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { queryBoolean, queryString } from '../utils/query.js';

type IdParams = { id: string };

export async function list(req: Request, res: Response) {
  const pagination = getPagination(req.query);
  const { items, total } = await userService.listUsers(
    {
      // El validador de la ruta ya restringió role al enum.
      role: queryString(req.query.role) as UserRole | undefined,
      alias: queryString(req.query.alias),
      isActive: queryBoolean(req.query.isActive),
    },
    pagination,
  );
  const viewer = getAuthUser(req);
  paginated(
    res,
    items.map((user) => userService.serializeUser(user, viewer)),
    buildMeta(total, pagination),
  );
}

export async function getById(req: Request<IdParams>, res: Response) {
  ok(res, await userService.getUserProfile(req.params.id, getAuthUser(req)));
}

export async function update(
  req: Request<IdParams, unknown, userService.UpdateUserInput>,
  res: Response,
) {
  const { displayName, avatarUrl, role, isActive } = req.body;
  ok(
    res,
    await userService.updateUser(req.params.id, getAuthUser(req), {
      displayName,
      avatarUrl,
      role,
      isActive,
    }),
  );
}

export async function remove(req: Request<IdParams>, res: Response) {
  await userService.deactivateUser(req.params.id, getAuthUser(req));
  noContent(res);
}
