/**
 * Curse Log de un usuario (docs/REGLAS.md §4). El estado y el tiempo restante se
 * calculan AL VUELO: una maldición `active` cuyo expiresAt ya pasó se informa como
 * `expired` aunque el scheduler todavía no la haya actualizado en la base.
 */
import type { QueryFilter } from 'mongoose';
import { User, type UserDocument } from '../models/User.js';
import {
  UserCurse,
  type IUserCurse,
  type UserCurseDocument,
  type UserCurseStatus,
} from '../models/UserCurse.js';
import { AppError } from '../utils/AppError.js';
import { assertOwnerOrAdmin } from './access.service.js';

const STATUS_ORDER: Record<UserCurseStatus, number> = { active: 0, served: 1, expired: 2 };

function effectiveStatus(curse: UserCurseDocument, now: Date): UserCurseStatus {
  return curse.status === 'active' && curse.expiresAt <= now ? 'expired' : curse.status;
}

/** Filtro de Mongo equivalente al estado efectivo pedido. */
function statusFilter(status: UserCurseStatus, now: Date): QueryFilter<IUserCurse> {
  switch (status) {
    case 'active':
      return { status: 'active', expiresAt: { $gt: now } };
    case 'expired':
      return { $or: [{ status: 'expired' }, { status: 'active', expiresAt: { $lte: now } }] };
    case 'served':
      return { status: 'served' };
  }
}

function serialize(curse: UserCurseDocument, now: Date): Record<string, unknown> {
  const status = effectiveStatus(curse, now);
  const total = curse.expiresAt.getTime() - curse.imposedAt.getTime();
  const elapsed = now.getTime() - curse.imposedAt.getTime();
  return {
    ...curse.toJSON(),
    status,
    // Para la barra de progreso del Curse Log del frontend.
    remainingSeconds:
      status === 'active' ? Math.ceil((curse.expiresAt.getTime() - now.getTime()) / 1000) : 0,
    progress: status === 'active' && total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 1,
  };
}

/** Dueño o admin. Activas primero (las que vencen antes arriba), después el resto. */
export async function listUserCurses(
  userId: string,
  actor: UserDocument,
  status?: UserCurseStatus,
): Promise<Record<string, unknown>[]> {
  assertOwnerOrAdmin(actor, userId, 'Solo podés ver tus propias maldiciones');
  if (!(await User.exists({ _id: userId }))) throw AppError.notFound('El usuario no existe');

  const now = new Date();
  const curses = await UserCurse.find({
    user: userId,
    ...(status ? statusFilter(status, now) : {}),
  })
    .populate('curse', 'name description icon severity durationHours')
    .populate('sourceAuction', 'status closesAt object');

  // Orden sobre el log de UN usuario (decenas de documentos): en memoria está bien.
  // Los rankings, que recorren colecciones enteras, sí van por agregación.
  return curses
    .sort((a, b) => {
      const byStatus =
        STATUS_ORDER[effectiveStatus(a, now)] - STATUS_ORDER[effectiveStatus(b, now)];
      if (byStatus !== 0) return byStatus;
      return effectiveStatus(a, now) === 'active'
        ? a.expiresAt.getTime() - b.expiresAt.getTime()
        : b.imposedAt.getTime() - a.imposedAt.getTime();
    })
    .map((curse) => serialize(curse, now));
}
