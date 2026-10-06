/**
 * Apuestas paralelas (docs/REGLAS.md §5). Las fichas se descuentan al apostar y se
 * devuelven al cancelar; ambos movimientos son idempotentes (reputation.service).
 */
import { Types } from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { SideBet, type SideBetChips, type SideBetDocument } from '../models/SideBet.js';
import { User, type UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import type { Pagination } from '../utils/pagination.js';
import { assertOwnerOrAdmin, sameId } from './access.service.js';
import { findAuctionOr404, syncLifecycle } from './auction.service.js';
import { PUBLIC_USER_FIELDS } from './house.service.js';
import { applyReputationEvent, reputationKey } from './reputation.service.js';

export interface PlaceBetInput {
  auction: string;
  targetAlias: string;
  chips: SideBetChips;
}

const BET_POPULATE = [
  { path: 'targetUser', select: PUBLIC_USER_FIELDS },
  {
    path: 'auction',
    select: 'status opensAt closesAt winner winningBid object',
    populate: { path: 'object', select: 'name imageUrl' },
  },
];

function auctionClosed(message = 'La subasta ya cerró: no se puede apostar ni cancelar'): AppError {
  return AppError.conflict(message, [], 'AUCTION_NOT_OPEN');
}

async function findBetOr404(id: string): Promise<SideBetDocument> {
  const bet = await SideBet.findById(id);
  if (!bet) throw AppError.notFound('La apuesta no existe');
  return bet;
}

/**
 * Marca la apuesta como cancelada (solo si sigue pending), devuelve las fichas y
 * la borra. Cada paso es idempotente: si el proceso muere en el medio, repetir la
 * cancelación termina el trabajo sin devolver dos veces.
 */
async function cancelAndRefund(bet: SideBetDocument): Promise<boolean> {
  const marked = await SideBet.updateOne(
    { _id: bet._id, result: 'pending' },
    { $set: { result: 'cancelled' } },
  );
  if (marked.modifiedCount === 0 && bet.result !== 'cancelled') return false; // ya resuelta
  await applyReputationEvent(bet.bettor, reputationKey.betRefund(bet._id), bet.chips);
  await SideBet.deleteOne({ _id: bet._id });
  return true;
}

export async function placeBet(
  actor: UserDocument,
  input: PlaceBetInput,
): Promise<SideBetDocument> {
  const auction = await syncLifecycle(await findAuctionOr404(input.auction));
  if (auction.status !== 'open' || new Date() >= auction.closesAt) {
    throw auctionClosed('Solo se puede apostar en una subasta abierta');
  }

  // Mismo mensaje para "no existe" y "no pujó": reduce lo que se puede sondear
  // (ver el conflicto documentado en REGLAS.md §5).
  const notParticipant = 'El alias indicado no participa en esta subasta';
  const target = await User.findOne({ alias: input.targetAlias }).select('_id alias');
  if (target && sameId(target._id, actor._id)) {
    const message = 'No podés apostar por vos mismo';
    throw AppError.unprocessable(message, [
      { field: 'targetAlias', value: input.targetAlias, message },
    ]);
  }
  if (!target || !(await Bid.exists({ auction: auction._id, user: target._id }))) {
    throw AppError.unprocessable(notParticipant, [
      { field: 'targetAlias', value: input.targetAlias, message: notParticipant },
    ]);
  }

  if (await SideBet.exists({ auction: auction._id, bettor: actor._id })) {
    throw AppError.conflict(
      'Ya apostaste en esta subasta: solo se permite una apuesta',
      [],
      'ALREADY_BET',
    );
  }

  // El id se genera antes para usarlo como clave del descuento: así el descuento
  // y la apuesta quedan atados aunque haya que compensar.
  const betId = new Types.ObjectId();
  const charged = await applyReputationEvent(
    actor._id,
    reputationKey.betStake(betId),
    -input.chips,
    {
      requireBalance: true,
    },
  );
  if (!charged) {
    throw AppError.conflict(
      `Reputación insuficiente: la apuesta requiere ${input.chips} fichas`,
      [],
      'INSUFFICIENT_REPUTATION',
    );
  }

  let bet: SideBetDocument;
  try {
    bet = await SideBet.create({
      _id: betId,
      auction: auction._id,
      bettor: actor._id,
      targetUser: target._id,
      chips: input.chips,
    });
  } catch (error) {
    // No se creó (ej. apuesta simultánea → índice único): devolver las fichas.
    await applyReputationEvent(actor._id, reputationKey.betRefund(betId), input.chips);
    throw error;
  }

  // Carrera con el cierre: si la subasta se cerró mientras se registraba, la
  // liquidación pudo no ver esta apuesta. Se cancela y se devuelven las fichas.
  const current = await Auction.findById(auction._id).select('status');
  if (current?.status !== 'open') {
    if (await cancelAndRefund(bet))
      throw auctionClosed('La subasta cerró mientras se registraba la apuesta');
  }
  return bet.populate(BET_POPULATE);
}

export async function listMyBets(
  actor: UserDocument,
  { skip, limit }: Pagination,
): Promise<{ items: SideBetDocument[]; total: number }> {
  const query = { bettor: actor._id };
  const [items, total] = await Promise.all([
    SideBet.find(query).populate(BET_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    SideBet.countDocuments(query),
  ]);
  return { items, total };
}

export async function getBet(id: string, actor: UserDocument): Promise<SideBetDocument> {
  const bet = await findBetOr404(id);
  assertOwnerOrAdmin(actor, bet.bettor, 'Solo podés ver tus propias apuestas');
  return bet.populate(BET_POPULATE);
}

/** Cancelar mientras la subasta siga open: devuelve las fichas. 409 si ya cerró. */
export async function cancelBet(id: string, actor: UserDocument): Promise<void> {
  const bet = await findBetOr404(id);
  assertOwnerOrAdmin(actor, bet.bettor, 'Solo podés cancelar tus propias apuestas');

  const auction = await syncLifecycle(await findAuctionOr404(String(bet.auction)));
  if (auction.status !== 'open' || new Date() >= auction.closesAt) throw auctionClosed();
  if (!(await cancelAndRefund(bet))) throw auctionClosed('La apuesta ya fue resuelta');
}
