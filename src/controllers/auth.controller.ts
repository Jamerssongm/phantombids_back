import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import * as authService from '../services/auth.service.js';
import { created, ok } from '../utils/apiResponse.js';

// Controllers delgados: toman de req solo los campos permitidos, llaman al
// service y responden. Cualquier otro campo del body (role, reputation,
// isActive…) se ignora en silencio porque nunca se lee.

export async function register(
  req: Request<object, unknown, authService.RegisterInput>,
  res: Response,
) {
  const { email, password, displayName, avatarUrl } = req.body;
  const { user, token } = await authService.register({ email, password, displayName, avatarUrl });
  created(res, { user, token });
}

export async function login(req: Request<object, unknown, authService.LoginInput>, res: Response) {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password });
  ok(res, { user, token });
}

export async function getMe(req: Request, res: Response) {
  ok(res, authService.getMe(getAuthUser(req)));
}

export async function updateMe(
  req: Request<object, unknown, authService.UpdateMeInput>,
  res: Response,
) {
  const { displayName, avatarUrl } = req.body;
  const user = await authService.updateMe(getAuthUser(req), { displayName, avatarUrl });
  ok(res, user);
}
