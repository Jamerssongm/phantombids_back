import type { Request, Response } from 'express';
import { getAuthUser } from '../middlewares/auth.js';
import type { HouseRole } from '../models/HouseMembership.js';
import * as membershipService from '../services/membership.service.js';
import { created, noContent, ok } from '../utils/apiResponse.js';

type HouseParams = { id: string };
type MemberParams = { id: string; userId: string };

export async function list(req: Request<HouseParams>, res: Response) {
  ok(res, await membershipService.listMembers(req.params.id));
}

export async function add(
  req: Request<HouseParams, unknown, membershipService.AddMemberInput>,
  res: Response,
) {
  const { userId, houseRole } = req.body;
  const membership = await membershipService.addMember(req.params.id, getAuthUser(req), {
    userId,
    houseRole,
  });
  created(res, membership, `${req.baseUrl}/${userId}`);
}

export async function updateRole(
  req: Request<MemberParams, unknown, { houseRole: HouseRole }>,
  res: Response,
) {
  const { houseRole } = req.body;
  ok(
    res,
    await membershipService.updateMemberRole(
      req.params.id,
      req.params.userId,
      getAuthUser(req),
      houseRole,
    ),
  );
}

export async function remove(req: Request<MemberParams>, res: Response) {
  await membershipService.removeMember(req.params.id, req.params.userId, getAuthUser(req));
  noContent(res);
}
