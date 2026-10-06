import type { QueryFilter } from 'mongoose';
import { Auction } from '../models/Auction.js';
import { CursedObject } from '../models/CursedObject.js';
import {
  HauntHouse,
  type HauntHouseDocument,
  type HouseTheme,
  type IHauntHouse,
} from '../models/HauntHouse.js';
import { HouseMembership } from '../models/HouseMembership.js';
import type { UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Pagination } from '../utils/pagination.js';
import { containsInsensitive } from '../utils/query.js';
import { assertHouseAdmin } from './access.service.js';

export interface HouseFilters {
  theme?: HouseTheme;
  name?: string;
  code?: string;
}

/** Campos que se aceptan al crear o editar una casa. createdBy nunca viene del body. */
export interface HouseInput {
  name: string;
  code: string;
  theme: HouseTheme;
  description?: string | null;
  coverImageUrl?: string | null;
}

/** Datos públicos de un usuario cuando aparece poblado dentro de otro recurso. */
export const PUBLIC_USER_FIELDS = 'alias displayName avatarUrl isActive';

export async function findHouseOr404(id: string): Promise<HauntHouseDocument> {
  const house = await HauntHouse.findById(id);
  if (!house) throw AppError.notFound('La casa no existe');
  return house;
}

export async function listHouses(
  filters: HouseFilters,
  { skip, limit }: Pagination,
): Promise<{ items: HauntHouseDocument[]; total: number }> {
  const query: QueryFilter<IHauntHouse> = {};
  if (filters.theme) query.theme = filters.theme;
  if (filters.name) query.name = containsInsensitive(filters.name);
  if (filters.code) query.code = containsInsensitive(filters.code);

  const [items, total] = await Promise.all([
    HauntHouse.find(query).sort({ name: 1 }).skip(skip).limit(limit),
    HauntHouse.countDocuments(query),
  ]);
  return { items, total };
}

/** Detalle con miembros (usuario poblado, sin email) y objetos (maldición poblada). */
export async function getHouseDetail(id: string): Promise<Record<string, unknown>> {
  const house = await findHouseOr404(id);
  const [members, objects] = await Promise.all([
    HouseMembership.find({ house: house._id })
      .populate('user', PUBLIC_USER_FIELDS)
      .sort({ joinedAt: 1 }),
    CursedObject.find({ house: house._id })
      .populate('curse', 'name icon severity durationHours')
      .sort({ name: 1 }),
  ]);
  return {
    ...house.toJSON(),
    members: members.map((m) => m.toJSON()),
    objects: objects.map((o) => o.toJSON()),
  };
}

/**
 * Crea la casa y la membresía head_haunter del creador. Una casa sin head_haunter
 * es un estado inválido del que no se sale por API, así que si la membresía
 * falla, se borra la casa (compensación). No se usa una transacción porque exige
 * replica set y la base local de desarrollo es standalone; Atlas sí lo es.
 */
export async function createHouse(
  actor: UserDocument,
  input: HouseInput,
): Promise<HauntHouseDocument> {
  const house = await HauntHouse.create({
    name: input.name,
    code: input.code,
    theme: input.theme,
    description: input.description ?? undefined,
    coverImageUrl: input.coverImageUrl ?? undefined,
    createdBy: actor._id,
  });
  try {
    await HouseMembership.create({ user: actor._id, house: house._id, houseRole: 'head_haunter' });
  } catch (error) {
    await house.deleteOne();
    throw error;
  }
  return house;
}

/** head_haunter o admin. Carga + save() para que corran las validaciones del schema. */
export async function updateHouse(
  id: string,
  actor: UserDocument,
  input: Partial<HouseInput>,
): Promise<HauntHouseDocument> {
  const house = await findHouseOr404(id);
  await assertHouseAdmin(actor, house._id);

  if (input.name !== undefined) house.name = input.name;
  if (input.code !== undefined) house.code = input.code;
  if (input.theme !== undefined) house.theme = input.theme;
  for (const field of ['description', 'coverImageUrl'] as const) {
    if (input[field] === null) house.set(field, undefined);
    else if (input[field] !== undefined) house[field] = input[field];
  }
  await house.save();
  return house;
}

/**
 * head_haunter o admin. 409 si hay subastas abiertas. Además, como un objeto con
 * subastas que no estén en `scheduled` no se puede borrar (es historia: pujas,
 * apuestas y maldiciones lo referencian), una casa que tenga objetos así tampoco.
 * Si pasa los chequeos, borra en cascada subastas programadas, objetos y
 * membresías (docs/REGLAS.md, "Borrados").
 */
export async function deleteHouse(id: string, actor: UserDocument): Promise<void> {
  const house = await findHouseOr404(id);
  await assertHouseAdmin(actor, house._id);

  const objectIds = (await CursedObject.find({ house: house._id }).select('_id')).map((o) => o._id);
  const auctions = await Auction.find({ object: { $in: objectIds } }).select('status');

  const open = auctions.filter((a) => a.status === 'open').length;
  if (open > 0) {
    throw AppError.conflict(
      `La casa tiene ${open} subasta(s) abierta(s) y no se puede borrar`,
      [],
      'HOUSE_HAS_OPEN_AUCTIONS',
    );
  }
  if (auctions.some((a) => a.status !== 'scheduled')) {
    throw AppError.conflict(
      'La casa tiene subastas cerradas o canceladas: su historial de pujas y apuestas impide borrarla',
      [],
      'HOUSE_HAS_HISTORY',
    );
  }

  // Primero la casa: si algo falla después, quedan restos inaccesibles en vez de
  // una casa visible sin miembros.
  await house.deleteOne();
  await Auction.deleteMany({ object: { $in: objectIds } });
  await CursedObject.deleteMany({ house: house._id });
  await HouseMembership.deleteMany({ house: house._id });
}
