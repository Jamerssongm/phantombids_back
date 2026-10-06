import type { Types } from 'mongoose';
import { HouseMembership, type HouseRole } from '../models/HouseMembership.js';
import type { UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * Chequeos de autorización que NO son rol global. `autorizar('admin')` cubre lo
 * global en la ruta; la propiedad de un recurso y el rol dentro de una casa
 * necesitan consultar datos, así que se resuelven acá y los usan los services.
 *
 * Regla común (docs/REGLAS.md §7): `admin` pasa todos los chequeos sin necesidad
 * de ser miembro ni dueño.
 */

type Id = Types.ObjectId | string;

export function isAdmin(user: UserDocument): boolean {
  return user.role === 'admin';
}

export function sameId(a: Id | undefined | null, b: Id | undefined | null): boolean {
  return a != null && b != null && String(a) === String(b);
}

/** Dueño del recurso o admin; si no, 403. */
export function assertOwnerOrAdmin(
  actor: UserDocument,
  ownerId: Id,
  message = 'Solo el dueño o un administrador pueden realizar esta acción',
): void {
  if (!isAdmin(actor) && !sameId(actor._id, ownerId)) throw AppError.forbidden(message);
}

/** Rol de casa del usuario, o null si no es miembro. */
export async function getHouseRole(userId: Id, houseId: Id): Promise<HouseRole | null> {
  const membership = await HouseMembership.findOne({ user: userId, house: houseId }).select(
    'houseRole',
  );
  return membership?.houseRole ?? null;
}

/** head_haunter de la casa, o admin; si no, 403. */
export async function assertHouseAdmin(
  actor: UserDocument,
  houseId: Id,
  message = 'Solo el head_haunter de la casa o un administrador pueden realizar esta acción',
): Promise<void> {
  if (isAdmin(actor)) return;
  if ((await getHouseRole(actor._id, houseId)) !== 'head_haunter') {
    throw AppError.forbidden(message);
  }
}

/** Miembro de la casa (cualquier rol), o admin; si no, 403. */
export async function assertHouseMember(
  actor: UserDocument,
  houseId: Id,
  message = 'Tenés que ser miembro de la casa para realizar esta acción',
): Promise<void> {
  if (isAdmin(actor)) return;
  if (!(await getHouseRole(actor._id, houseId))) throw AppError.forbidden(message);
}
