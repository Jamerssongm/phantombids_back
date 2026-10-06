import type { QueryFilter } from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Curse } from '../models/Curse.js';
import {
  CursedObject,
  type CursedObjectDocument,
  type ICursedObject,
} from '../models/CursedObject.js';
import { HauntHouse } from '../models/HauntHouse.js';
import type { UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Pagination } from '../utils/pagination.js';
import { assertHouseAdmin, assertHouseMember, isAdmin, sameId } from './access.service.js';

export interface ObjectFilters {
  house?: string;
  curse?: string;
}

/** Campos aceptados al crear. createdBy sale del usuario autenticado, nunca del body. */
export interface CreateObjectInput {
  name: string;
  imageUrl?: string | null;
  house: string;
  curse: string;
  minBid: number;
  maxBid: number;
}

/** Campos editables. La casa NO se cambia: mover un objeto cambiaría quién lo administra. */
export type UpdateObjectInput = Partial<Omit<CreateObjectInput, 'house'>>;

const POPULATE = [
  { path: 'house', select: 'name code theme' },
  { path: 'curse', select: 'name icon severity durationHours' },
];

function unprocessableRef(field: string, value: string, message: string): AppError {
  return AppError.unprocessable(message, [{ field, value, message }]);
}

async function assertCurseExists(curseId: string): Promise<void> {
  if (!(await Curse.exists({ _id: curseId }))) {
    throw unprocessableRef('curse', curseId, 'La maldición indicada no existe');
  }
}

async function findObjectOr404(id: string): Promise<CursedObjectDocument> {
  const object = await CursedObject.findById(id);
  if (!object) throw AppError.notFound('El objeto no existe');
  return object;
}

/** Creador del objeto, head_haunter de su casa, o admin; si no, 403. */
async function assertCanManageObject(actor: UserDocument, object: CursedObjectDocument) {
  if (isAdmin(actor) || sameId(actor._id, object.createdBy)) return;
  await assertHouseAdmin(
    actor,
    object.house,
    'Solo el creador del objeto, el head_haunter de su casa o un administrador pueden modificarlo',
  );
}

export async function listObjects(
  filters: ObjectFilters,
  { skip, limit }: Pagination,
): Promise<{ items: CursedObjectDocument[]; total: number }> {
  const query: QueryFilter<ICursedObject> = {};
  if (filters.house) query.house = filters.house;
  if (filters.curse) query.curse = filters.curse;

  const [items, total] = await Promise.all([
    CursedObject.find(query).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CursedObject.countDocuments(query),
  ]);
  return { items, total };
}

export async function getObject(id: string): Promise<CursedObjectDocument> {
  return (await findObjectOr404(id)).populate(POPULATE);
}

/**
 * Miembro de la casa (o admin). maxBid > minBid lo valida el pre('validate') del
 * schema, que sí corre en create().
 */
export async function createObject(
  actor: UserDocument,
  input: CreateObjectInput,
): Promise<CursedObjectDocument> {
  if (!(await HauntHouse.exists({ _id: input.house }))) {
    throw unprocessableRef('house', input.house, 'La casa indicada no existe');
  }
  await assertHouseMember(
    actor,
    input.house,
    'Solo los miembros de la casa pueden publicar objetos en ella',
  );
  await assertCurseExists(input.curse);

  const object = await CursedObject.create({
    name: input.name,
    imageUrl: input.imageUrl ?? undefined,
    house: input.house,
    curse: input.curse,
    minBid: input.minBid,
    maxBid: input.maxBid,
    createdBy: actor._id,
  });
  return object.populate(POPULATE);
}

/**
 * Criterio de validación en el update: carga + mutación + save(). Así el
 * pre('validate') del schema compara maxBid > minBid sobre el estado FINAL del
 * documento (por ejemplo, si solo llega minBid, contra el maxBid guardado), cosa
 * que findOneAndUpdate no haría.
 */
export async function updateObject(
  id: string,
  actor: UserDocument,
  input: UpdateObjectInput,
): Promise<CursedObjectDocument> {
  const object = await findObjectOr404(id);
  await assertCanManageObject(actor, object);

  if (await Auction.exists({ object: object._id, status: 'open' })) {
    throw AppError.conflict(
      'El objeto tiene una subasta abierta: no se puede editar mientras hay pujas en curso',
      [],
      'OBJECT_HAS_OPEN_AUCTION',
    );
  }
  if (input.curse !== undefined) await assertCurseExists(input.curse);

  if (input.name !== undefined) object.name = input.name;
  if (input.imageUrl === null) object.set('imageUrl', undefined);
  else if (input.imageUrl !== undefined) object.imageUrl = input.imageUrl;
  if (input.curse !== undefined) object.set('curse', input.curse);
  if (input.minBid !== undefined) object.minBid = input.minBid;
  if (input.maxBid !== undefined) object.maxBid = input.maxBid;

  await object.save();
  return object.populate(POPULATE);
}

/**
 * Mismos permisos que editar. 409 si tiene subastas en un estado distinto de
 * scheduled (son historia). Las programadas se borran con el objeto.
 */
export async function deleteObject(id: string, actor: UserDocument): Promise<void> {
  const object = await findObjectOr404(id);
  await assertCanManageObject(actor, object);

  const started = await Auction.countDocuments({
    object: object._id,
    status: { $ne: 'scheduled' },
  });
  if (started > 0) {
    throw AppError.conflict(
      'El objeto tiene subastas abiertas, cerradas o canceladas: su historial impide borrarlo',
      [],
      'OBJECT_HAS_AUCTIONS',
    );
  }
  await Auction.deleteMany({ object: object._id });
  await object.deleteOne();
}
