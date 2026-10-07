/**
 * Subastas: CRUD, ciclo de vida, lectura respetando el secreto de las pujas y
 * APLICACIÓN DEL RESULTADO del cierre. Reglas: docs/REGLAS.md §1, §2, §2b, §3 y §5.
 *
 * ── Consistencia SIN transacciones (trade-off deliberado) ──────────────────────
 * Las transacciones de MongoDB exigen replica set; el entorno de desarrollo es un
 * Mongo standalone en Docker. Se eligió PORTABILIDAD sobre ATOMICIDAD: el código
 * corre igual en un Mongo suelto y en Atlas. A cambio, el cierre se diseñó para
 * ser idempotente y seguro ante ejecución concurrente:
 *
 *  1. CLAIM: el paso open → closed es un findOneAndUpdate con `status: 'open'` en
 *     el filtro. Solo una ejecución lo gana; las demás no hacen nada. Fija además
 *     `resolvedAt`, el corte: solo cuentan las pujas creadas hasta ese instante,
 *     así cualquier re-ejecución ve exactamente el mismo conjunto de pujas.
 *  2. SETTLE: los efectos derivados se aplican después, en orden determinista, y
 *     cada escritura es idempotente por sí misma:
 *       a. resultado (estado final, ganador, motivo): $set de valores que salen
 *          de una función pura sobre un conjunto fijo de pujas → mismo valor;
 *       b. isDuplicate: updateMany con $set → aplicarlo dos veces no cambia nada;
 *       c. maldición: upsert con $setOnInsert sobre (user, sourceAuction), que
 *          además tiene índice único → nunca dos maldiciones por la misma puja;
 *       d. reputación −10 y payouts: movimientos con clave única aplicados en un
 *          único updateOne atómico (reputation.service.ts);
 *       e. apuestas: pending → won/lost con filtro `result: 'pending'`; el crédito
 *          del payout se recorre sobre TODAS las ganadas (no solo las recién
 *          pasadas) y lo protege su clave, así no se pierde si el proceso murió
 *          entre el cambio de estado y el crédito.
 *  3. Al final se fija `settledAt`. Una subasta cerrada sin `settledAt` quedó a
 *     mitad: el scheduler y cualquier acceso posterior (syncLifecycle) la
 *     completan. Con `settledAt`, nunca se vuelve a procesar.
 *
 * Lo que se pierde frente a una transacción: durante unos milisegundos otro
 * lector puede ver un estado intermedio (subasta cerrada con efectos todavía en
 * curso). Nunca se ve un efecto duplicado ni se pierde uno.
 */
import { randomInt } from 'node:crypto';
import mongoose, { type PopulateOptions, type QueryFilter } from 'mongoose';
import {
  Auction,
  type AuctionDocument,
  type AuctionStatus,
  type IAuction,
} from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Curse } from '../models/Curse.js';
import { CursedObject } from '../models/CursedObject.js';
import { SideBet } from '../models/SideBet.js';
import { UserCurse } from '../models/UserCurse.js';
import type { UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Pagination } from '../utils/pagination.js';
import { assertHouseAdmin, assertHouseMember, isAdmin, sameId } from './access.service.js';
import { resolveAuction, type ResolutionResult } from './auctionResolver.js';
import { PUBLIC_USER_FIELDS } from './house.service.js';
import {
  DUPLICATE_BID_PENALTY,
  applyReputationEvent,
  reputationKey,
} from './reputation.service.js';
import { logger } from '../utils/logger.js';

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
 * Todas las transiciones son condicionales sobre el estado actual, así que dos
 * llamadas simultáneas no pueden aplicar nada dos veces.
 */
export async function syncLifecycle(auction: AuctionDocument): Promise<AuctionDocument> {
  const now = new Date();
  let changed = false;

  if (auction.status === 'scheduled' && auction.opensAt <= now) {
    await Auction.updateOne(
      { _id: auction._id, status: 'scheduled' },
      { $set: { status: 'open' } },
    );
    changed = true;
  }
  if ((changed || auction.status === 'open') && auction.closesAt <= now) {
    await resolveAuctionById(auction._id);
    changed = true;
  }
  if (!changed && !isSecret(auction.status) && !auction.settledAt) {
    await settleAuction(auction); // cierre que quedó a mitad
    changed = true;
  }
  return changed ? findAuctionOr404(String(auction._id)) : auction;
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

// ─── Cierre y resultado ────────────────────────────────────────────────────────

type AuctionId = AuctionDocument['_id'];

/**
 * CLAIM + SETTLE. Devuelve true si ESTA llamada ganó el cierre. Si la subasta ya
 * no estaba open, no hace nada (otra ejecución la cerró o la está cerrando).
 */
export async function resolveAuctionById(auctionId: AuctionId | string): Promise<boolean> {
  const claimed = await Auction.findOneAndUpdate(
    { _id: auctionId, status: 'open' },
    // Estado provisional 'closed': settleAuction fija el definitivo (closed o
    // cancelled) en cuanto calcula el resultado.
    { $set: { status: 'closed', resolvedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!claimed) return false;
  await settleAuction(claimed);
  return true;
}

/** Pujas que cuentan para el resultado: las creadas hasta el corte. */
async function bidsForResolution(auction: AuctionDocument) {
  const cutoff = auction.resolvedAt ?? auction.closesAt;
  const bids = await Bid.find({ auction: auction._id, createdAt: { $lte: cutoff } })
    .select('user amount')
    .sort({ _id: 1 });
  return bids.map((bid) => ({
    bidId: String(bid._id),
    userId: String(bid.user),
    amount: bid.amount,
  }));
}

async function pickRandomCurse() {
  const curses = await Curse.find().select('durationHours').sort({ _id: 1 });
  return curses.length > 0 ? curses[randomInt(curses.length)]! : null;
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}

/** Penalización por puja duplicada (§3): maldición activa + −10. Idempotente. */
async function penalize(userId: string, auction: AuctionDocument, imposedAt: Date): Promise<void> {
  const exists = await UserCurse.exists({ user: userId, sourceAuction: auction._id });
  if (!exists) {
    const curse = await pickRandomCurse();
    if (curse) {
      try {
        await UserCurse.updateOne(
          { user: userId, sourceAuction: auction._id },
          {
            $setOnInsert: {
              curse: curse._id,
              reason: 'Puja duplicada detectada al cerrar la subasta.',
              imposedAt,
              expiresAt: new Date(imposedAt.getTime() + curse.durationHours * 60 * 60 * 1000),
              status: 'active',
            },
          },
          { upsert: true },
        );
      } catch (error) {
        // Dos ejecuciones concurrentes insertando la misma: gana una, la otra choca
        // con el índice único. El efecto ya está aplicado.
        if (!isDuplicateKeyError(error)) throw error;
      }
    } else {
      logger.warn('Catálogo de maldiciones vacío: se aplica solo la penalización de reputación');
    }
  }
  await applyReputationEvent(
    userId,
    reputationKey.duplicatePenalty(auction._id),
    -DUPLICATE_BID_PENALTY,
  );
}

/** Apuestas paralelas (§5): pending → won/lost y crédito de los payouts. Idempotente. */
async function settleBets(auction: AuctionDocument, result: ResolutionResult): Promise<void> {
  if (result.winner) {
    await SideBet.updateMany(
      { auction: auction._id, result: 'pending', targetUser: result.winner.userId },
      [{ $set: { result: 'won', payout: { $multiply: ['$chips', 3] } } }],
      { updatePipeline: true },
    );
  }
  await SideBet.updateMany(
    { auction: auction._id, result: 'pending' },
    { $set: { result: 'lost', payout: 0 } },
  );

  const won = await SideBet.find({ auction: auction._id, result: 'won' }).sort({ _id: 1 });
  for (const bet of won) {
    await applyReputationEvent(bet.bettor, reputationKey.betPayout(bet._id), bet.payout);
  }
}

/**
 * Aplica todos los efectos del cierre (ver cabecera del archivo). Se puede llamar
 * cualquier cantidad de veces sobre la misma subasta: el resultado es el mismo.
 */
export async function settleAuction(auction: AuctionDocument): Promise<void> {
  if (auction.settledAt || isSecret(auction.status)) return;

  const imposedAt = auction.resolvedAt ?? auction.closesAt;
  const result = resolveAuction(await bidsForResolution(auction));

  // a. Resultado definitivo.
  await Auction.updateOne(
    { _id: auction._id },
    result.winner
      ? {
          $set: {
            status: 'closed',
            winner: result.winner.userId,
            winningBid: result.winningAmount,
          },
          $unset: { cancellationReason: 1 },
        }
      : {
          $set: { status: 'cancelled', cancellationReason: result.cancellationReason },
          $unset: { winner: 1, winningBid: 1 },
        },
  );
  // b. Pujas duplicadas.
  if (result.duplicateBidIds.length > 0) {
    await Bid.updateMany({ _id: { $in: result.duplicateBidIds } }, { $set: { isDuplicate: true } });
  }
  // c y d. Penalizaciones, en orden determinista (penalizedUserIds viene ordenado).
  for (const userId of result.penalizedUserIds) await penalize(userId, auction, imposedAt);
  // e. Apuestas.
  await settleBets(auction, result);

  await Auction.updateOne(
    { _id: auction._id, settledAt: { $exists: false } },
    { $set: { settledAt: new Date() } },
  );
  logger.info(
    `Subasta ${String(auction._id)} liquidada: ${result.status}` +
      (result.winner
        ? `, gana ${result.winner.userId} con ${result.winningAmount}`
        : `, ${result.cancellationReason}`) +
      `, ${result.penalizedUserIds.length} penalizado(s)`,
  );
}

/**
 * Cierre manual: head_haunter de la casa o admin. 409 si ya está cerrada o si
 * todavía no abrió. Devuelve el resultado completo.
 */
export async function closeAuction(
  id: string,
  actor: UserDocument,
): Promise<Record<string, unknown>> {
  const found = await findAuctionOr404(id);
  await assertHouseAdmin(
    actor,
    await houseOf(found),
    'Solo el head_haunter de la casa o un administrador pueden cerrar la subasta',
  );

  const auction = await syncLifecycle(found);
  if (auction.status === 'scheduled') {
    throw AppError.conflict('La subasta todavía no abrió', [], 'AUCTION_NOT_OPEN');
  }
  if (!(await resolveAuctionById(auction._id))) {
    throw AppError.conflict('La subasta ya está cerrada', [], 'AUCTION_ALREADY_CLOSED');
  }
  return getAuctionResult(id);
}

/**
 * Resultado completo: ganador, todas las pujas reveladas con duplicados marcados,
 * penalizaciones aplicadas y resumen de apuestas. 409 mientras siga secreta.
 */
export async function getAuctionResult(id: string): Promise<Record<string, unknown>> {
  const auction = await syncLifecycle(await findAuctionOr404(id));
  if (isSecret(auction.status)) {
    throw AppError.conflict(
      'La subasta sigue abierta: el resultado se conoce al cerrar',
      [],
      'AUCTION_STILL_OPEN',
    );
  }

  await auction.populate(AUCTION_POPULATE);
  const [bids, penalties, bets] = await Promise.all([
    Bid.find({ auction: auction._id })
      .populate('user', PUBLIC_USER_FIELDS)
      .sort({ amount: 1, createdAt: 1 }),
    UserCurse.find({ sourceAuction: auction._id })
      .populate('user', PUBLIC_USER_FIELDS)
      .populate('curse', 'name icon severity durationHours')
      .sort({ user: 1 }),
    SideBet.aggregate<{ _id: string; count: number; payout: number }>([
      { $match: { auction: auction._id } },
      { $group: { _id: '$result', count: { $sum: 1 }, payout: { $sum: '$payout' } } },
    ]),
  ]);

  const { winner, winningBid, cancellationReason, status, resolvedAt, settledAt } =
    auction.toJSON();
  return {
    auction: auction.toJSON(),
    status,
    winner: winner ?? null,
    winningBid: winningBid ?? null,
    cancellationReason: cancellationReason ?? null,
    resolvedAt,
    settledAt,
    bids: bids.map((bid) => bid.toJSON()),
    penalties: penalties.map((p) => ({
      ...p.toJSON(),
      reputationLoss: DUPLICATE_BID_PENALTY,
    })),
    bets: Object.fromEntries(bets.map((b) => [b._id, { count: b.count, payout: b.payout }])),
  };
}
