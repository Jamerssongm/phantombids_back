import {
  HouseMembership,
  type HouseMembershipDocument,
  type HouseRole,
} from '../models/HouseMembership.js';
import { User, type UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { assertHouseAdmin, sameId } from './access.service.js';
import { PUBLIC_USER_FIELDS, findHouseOr404 } from './house.service.js';

export interface AddMemberInput {
  userId: string;
  houseRole?: HouseRole;
}

async function findMembershipOr404(
  houseId: string,
  userId: string,
): Promise<HouseMembershipDocument> {
  const membership = await HouseMembership.findOne({ house: houseId, user: userId });
  if (!membership) throw AppError.notFound('El usuario no es miembro de esta casa');
  return membership;
}

/**
 * Una casa no puede quedarse sin head_haunter (docs/REGLAS.md §7). Se llama antes
 * de degradar o quitar a un head_haunter.
 *
 * Límite conocido: dos operaciones simultáneas sobre los dos últimos head_haunter
 * podrían pasar ambas el chequeo. Cerrarlo del todo exige una transacción.
 */
async function assertNotLastHeadHaunter(membership: HouseMembershipDocument, action: string) {
  if (membership.houseRole !== 'head_haunter') return;
  const heads = await HouseMembership.countDocuments({
    house: membership.house,
    houseRole: 'head_haunter',
  });
  if (heads <= 1) {
    throw AppError.conflict(
      `No se puede ${action} al último head_haunter: la casa quedaría sin administrador. ` +
        'Nombrá otro head_haunter primero.',
      [],
      'LAST_HEAD_HAUNTER',
    );
  }
}

export async function listMembers(houseId: string): Promise<HouseMembershipDocument[]> {
  const house = await findHouseOr404(houseId);
  return HouseMembership.find({ house: house._id })
    .populate('user', PUBLIC_USER_FIELDS)
    .sort({ joinedAt: 1 });
}

/** head_haunter o admin. 409 si ya es miembro o si el usuario está dado de baja. */
export async function addMember(
  houseId: string,
  actor: UserDocument,
  input: AddMemberInput,
): Promise<HouseMembershipDocument> {
  const house = await findHouseOr404(houseId);
  await assertHouseAdmin(actor, house._id);

  const user = await User.findById(input.userId);
  if (!user) {
    const message = 'El usuario indicado no existe';
    throw AppError.unprocessable(message, [{ field: 'userId', value: input.userId, message }]);
  }
  if (!user.isActive) {
    throw AppError.conflict('El usuario está dado de baja', [], 'USER_INACTIVE');
  }
  if (await HouseMembership.exists({ house: house._id, user: user._id })) {
    throw AppError.conflict('El usuario ya es miembro de esta casa', [], 'ALREADY_MEMBER');
  }

  const membership = await HouseMembership.create({
    house: house._id,
    user: user._id,
    houseRole: input.houseRole ?? 'spirit',
  });
  return membership.populate('user', PUBLIC_USER_FIELDS);
}

/** head_haunter o admin. 409 si degrada al último head_haunter. */
export async function updateMemberRole(
  houseId: string,
  userId: string,
  actor: UserDocument,
  houseRole: HouseRole,
): Promise<HouseMembershipDocument> {
  const house = await findHouseOr404(houseId);
  await assertHouseAdmin(actor, house._id);

  const membership = await findMembershipOr404(houseId, userId);
  if (houseRole !== 'head_haunter') await assertNotLastHeadHaunter(membership, 'degradar');
  membership.houseRole = houseRole;
  await membership.save();
  return membership.populate('user', PUBLIC_USER_FIELDS);
}

/**
 * head_haunter o admin pueden expulsar; cualquier miembro puede salirse solo.
 * 409 si es el último head_haunter, también cuando se sale él mismo.
 */
export async function removeMember(
  houseId: string,
  userId: string,
  actor: UserDocument,
): Promise<void> {
  const house = await findHouseOr404(houseId);
  const leavingHimself = sameId(actor._id, userId);
  if (!leavingHimself) {
    await assertHouseAdmin(
      actor,
      house._id,
      'Solo el head_haunter o un administrador pueden expulsar miembros',
    );
  }

  const membership = await findMembershipOr404(houseId, userId);
  await assertNotLastHeadHaunter(membership, leavingHimself ? 'retirar' : 'expulsar');
  await membership.deleteOne();
}
