import type { QueryFilter } from 'mongoose';
import { User, type IUser, type UserDocument, type UserRole } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Pagination } from '../utils/pagination.js';
import { containsInsensitive } from '../utils/query.js';
import { assertOwnerOrAdmin, isAdmin, sameId } from './access.service.js';

export interface UserFilters {
  role?: UserRole;
  alias?: string;
  isActive?: boolean;
}

/**
 * Campos editables por PUT /users/:id. reputation NO está: la mueve solo la
 * lógica de negocio (REGLAS.md §1). email tampoco: no hay flujo de verificación.
 */
export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: string | null;
  role?: UserRole; // solo admin
  isActive?: boolean; // solo admin
}

/**
 * Serializador explícito del perfil: el email solo lo ven el dueño y los admin.
 * passwordHash, _id y __v ya los quita el toJSON del modelo.
 */
export function serializeUser(user: UserDocument, viewer?: UserDocument): Record<string, unknown> {
  // toJSON ya aplicó el transform (id, sin _id/__v/passwordHash).
  const json: Record<string, unknown> = { ...user.toJSON() };
  const canSeePrivate = viewer && (isAdmin(viewer) || sameId(viewer._id, user._id));
  if (!canSeePrivate) delete json.email;
  return json;
}

async function findUserOr404(id: string): Promise<UserDocument> {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('El usuario no existe');
  return user;
}

export async function listUsers(
  filters: UserFilters,
  { skip, limit }: Pagination,
): Promise<{ items: UserDocument[]; total: number }> {
  const query: QueryFilter<IUser> = {};
  if (filters.role) query.role = filters.role;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.alias) query.alias = containsInsensitive(filters.alias);

  const [items, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);
  return { items, total };
}

export async function getUserProfile(
  id: string,
  viewer: UserDocument,
): Promise<Record<string, unknown>> {
  return serializeUser(await findUserOr404(id), viewer);
}

/**
 * Dueño: displayName y avatarUrl. Admin: además role e isActive. Si un no-admin
 * manda role o isActive, se ignoran en silencio (lista blanca por rol).
 * Carga + save() para que corran las validaciones del schema.
 */
export async function updateUser(
  id: string,
  actor: UserDocument,
  input: UpdateUserInput,
): Promise<Record<string, unknown>> {
  const user = await findUserOr404(id);
  assertOwnerOrAdmin(actor, user._id, 'Solo podés editar tu propio perfil');

  if (input.displayName !== undefined) user.displayName = input.displayName;
  if (input.avatarUrl === null) user.set('avatarUrl', undefined);
  else if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;

  if (isAdmin(actor)) {
    const self = sameId(actor._id, user._id);
    // Un admin no puede quitarse a sí mismo el rol ni darse de baja: podría dejar
    // el sistema sin ningún admin, y no hay forma de recuperarlo por API.
    if (self && input.role !== undefined && input.role !== 'admin') {
      throw AppError.conflict(
        'Un administrador no puede quitarse su propio rol',
        [],
        'SELF_DEMOTION',
      );
    }
    if (self && input.isActive === false) {
      throw AppError.conflict(
        'Un administrador no puede darse de baja a sí mismo',
        [],
        'SELF_DEACTIVATION',
      );
    }
    if (input.role !== undefined) user.role = input.role;
    if (input.isActive !== undefined) user.isActive = input.isActive;
  }

  await user.save();
  return serializeUser(user, actor);
}

/**
 * Baja LÓGICA (isActive: false), nunca física: pujas, apuestas, membresías y
 * maldiciones lo referencian. `autenticar` rechaza a los inactivos, así que la
 * baja surte efecto inmediato aunque tenga un token vigente. Idempotente.
 */
export async function deactivateUser(id: string, actor: UserDocument): Promise<void> {
  if (sameId(actor._id, id)) {
    throw AppError.conflict(
      'Un administrador no puede darse de baja a sí mismo',
      [],
      'SELF_DEACTIVATION',
    );
  }
  const user = await findUserOr404(id);
  if (!user.isActive) return;
  user.isActive = false;
  await user.save();
}
