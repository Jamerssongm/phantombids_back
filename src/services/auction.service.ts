/**
 * Subastas: CRUD, ciclo de vida y lectura respetando el secreto de las pujas.
 * Reglas: docs/REGLAS.md §2 y §2b.
 */
import type { PopulateOptions, QueryFilter } from 'mongoose';
import {
  Auction,
  type AuctionDocument,
  type AuctionStatus,
  type IAuction,
} from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { CursedObject } from '../models/CursedObject.js';
import type { UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Pagination } from '../utils/pagination.js';
import { assertHouseAdmin, assertHouseMember, isAdmin, sameId } from './access.service.js';
import { PUBLIC_USER_FIELDS } from './house.service.js';

export interface AuctionFilters {
  status?: AuctionStatus;
  house?: string;
  object?: string;
}

export interface CreateAuctionInput {
  object: string;
  opensAt: Date;
  closesAt: Date;
}

export type UpdateAuctionInput = Partial<Omit<CreateAuctionInput, 'object'>>;

export const ACTIVE_STATUSES: AuctionStatus[] = ['scheduled', 'open'];

export const AUCTION_POPULATE: PopulateOptions[] = [
  {
    path: 'object',
    select: 'name imageUrl minBid maxBid house curse',
    populate: [
      { path: 'house', select: 'name code theme' },
      { path: 'curse', select: 'name icon severity durationHours' },
    ],
  },
  { path: 'winner', select: PUBLIC_USER_FIELDS },
];

export function isSecret(status: AuctionStatus): boolean {
  return status === 'scheduled' || status === 'open';
}

export async function findAuctionOr404(id: string): Promise<AuctionDocument> {
  const auction = await Auction.findById(id);
  if (!auction) throw AppError.notFound('La subasta no existe');
  return auction;
}

/**
 * Aplica las transiciones por tiempo que correspondan (REGLAS.md §2b) y devuelve
 * la subasta actualizada. Es la versión "perezosa" del scheduler: se llama en
 * cada acceso para que el estado sea correcto aunque el proceso haya dormido.
 * La transición es condicional sobre el estado actual: dos llamadas simultáneas
 * no pueden aplicarla dos veces.
 */
export async function syncLifecycle(auction: AuctionDocument): Promise<AuctionDocument> {
  const now = new Date();
  if (auction.status === 'scheduled' && auction.opensAt <= now) {
    await Auction.updateOne(
      { _id: auction._id, status: 'scheduled' },
      { $set: { status: 'open' } },
    );
    return findAuctionOr404(String(auction._id));
  }
  return auction;
}

/** Casa del objeto subastado (la subasta no guarda la casa: se deriva del objeto). */
async function houseOf(auction: AuctionDocument) {
  const object = await CursedObject.findById(auction.object).select('house');
  if (!object) throw AppError.internal('La subasta referencia un objeto inexistente');
  return object.house;
}

/** Quien creó la subasta, el head_haunter de la casa, o admin. */
async function assertCanManageAuction(actor: UserDocument, auction: AuctionDocument) {
  if (isAdmin(actor) || sameId(actor._id, auction.createdBy)) return;
  await assertHouseAdmin(
    actor,
    await houseOf(auction),
    'Solo quien creó la subasta, el head_haunter de la casa o un administrador pueden modificarla',
  );
}

function assertSchedule(opensAt: Date, closesAt: Date, { requireFutureOpen = true } = {}) {
  const details = [];
  if (requireFutureOpen && opensAt <= new Date()) {
    details.push({
      field: 'opensAt',
      value: opensAt,
      message: 'La apertura debe ser en el futuro',
    });
  }
  if (closesAt <= opensAt) {
    details.push({
      field: 'closesAt',
      value: closesAt,
      message: 'La fecha de cierre debe ser posterior a la de apertura',
    });
  }
  if (details.length > 0) {
    throw AppError.unprocessable('Las fechas de la subasta no son válidas', details);
  }
}

export async function listAuctions(
  filters: AuctionFilters,
  { skip, limit }: Pagination,
): Promise<{ items: AuctionDocument[]; total: number }> {
  const query: QueryFilter<IAuction> = {};
  if (filters.status) query.status = filters.status;
  if (filters.object) query.object = filters.object;
  if (filters.house) {
    const objectIds = await CursedObject.find({ house: filters.house }).distinct('_id');
    query.object = filters.object
      ? { $in: objectIds.filter((id) => String(id) === filters.object) }
      : { $in: objectIds };
  }

  const [items, total] = await Promise.all([
    Auction.find(query).populate(AUCTION_POPULATE).sort({ opensAt: -1 }).skip(skip).limit(limit),
    Auction.countDocuments(query),
  ]);
  return { items, total };
}

/**
 * Detalle de una subasta. EL SECRETO DE LAS PUJAS SE RESUELVE ACÁ:
 * mientras esté scheduled/open, solo se consulta la puja del propio usuario
 * (findOne por auction + user): las pujas ajenas ni siquiera se cargan en
 * memoria, y no se calcula ningún conteo. La respuesta no incluye ningún campo
 * derivado de ellas.
 */
export async function getAuctionForViewer(
  id: string,
  viewer?: UserDocument,
): Promise<Record<string, unknown>> {
  const auction = await syncLifecycle(await findAuctionOr404(id));
  await auction.populate(AUCTION_POPULATE);

  const myBid = viewer
    ? await Bid.findOne({ auction: auction._id, user: viewer._id }).select(
        'amount isDuplicate createdAt',
      )
    : null;

  return {
    ...auction.toJSON(),
    myBid: myBid ? myBid.toJSON() : null,
  };
}

/** Miembro de la casa del objeto, o admin. Un objeto, una subasta activa a la vez. */
export async function createAuction(
  actor: UserDocument,
  input: CreateAuctionInput,
): Promise<AuctionDocument> {
  const object = await CursedObject.findById(input.object).select('house');
  if (!object) {
    const message = 'El objeto indicado no existe';
    throw AppError.unprocessable(message, [{ field: 'object', value: input.object, message }]);
  }
  await assertHouseMember(
    actor,
    object.house,
    'Solo los miembros de la casa pueden subastar sus objetos',
  );
  assertSchedule(input.opensAt, input.closesAt);

  if (await Auction.exists({ object: object._id, status: { $in: ACTIVE_STATUSES } })) {
    throw AppError.conflict(
      'El objeto ya tiene una subasta programada o abierta',
      [],
      'OBJECT_HAS_ACTIVE_AUCTION',
    );
  }

  const auction = await Auction.create({
    object: object._id,
    opensAt: input.opensAt,
    closesAt: input.closesAt,
    status: 'scheduled',
    createdBy: actor._id,
  });
  return auction.populate(AUCTION_POPULATE);
}

/**
 * Solo scheduled. La validación closesAt > opensAt se hace A MANO en el service
 * sobre las fechas finales (las nuevas combinadas con las guardadas): el
 * pre('validate') del schema no corre en findOneAndUpdate, y no hay que depender
 * de cómo se persista.
 */
export async function updateAuction(
  id: string,
  actor: UserDocument,
  input: UpdateAuctionInput,
): Promise<AuctionDocument> {
  const auction = await syncLifecycle(await findAuctionOr404(id));
  await assertCanManageAuction(actor, auction);
  if (auction.status !== 'scheduled') {
    throw AppError.conflict(
      'Solo se puede editar una subasta programada: esta ya abrió y puede tener pujas',
      [],
      'AUCTION_NOT_EDITABLE',
    );
  }

  const opensAt = input.opensAt ?? auction.opensAt;
  const closesAt = input.closesAt ?? auction.closesAt;
  assertSchedule(opensAt, closesAt);

  auction.opensAt = opensAt;
  auction.closesAt = closesAt;
  await auction.save();
  return auction.populate(AUCTION_POPULATE);
}

/** Solo scheduled y sin pujas. */
export async function deleteAuction(id: string, actor: UserDocument): Promise<void> {
  const auction = await syncLifecycle(await findAuctionOr404(id));
  await assertCanManageAuction(actor, auction);
  if (auction.status !== 'scheduled' || (await Bid.exists({ auction: auction._id }))) {
    throw AppError.conflict(
      'Solo se puede borrar una subasta programada y sin pujas',
      [],
      'AUCTION_NOT_DELETABLE',
    );
  }
  await auction.deleteOne();
}
