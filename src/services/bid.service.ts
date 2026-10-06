/**
 * Pujas secretas (docs/REGLAS.md §2 y §2b). Todas las validaciones de negocio
 * viven acá; el schema solo valida forma.
 */
import { Auction } from '../models/Auction.js';
import { Bid, type BidDocument } from '../models/Bid.js';
import { CursedObject } from '../models/CursedObject.js';
import type { UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { findAuctionOr404, isSecret, syncLifecycle } from './auction.service.js';
import { PUBLIC_USER_FIELDS } from './house.service.js';

function notOpen(message: string): AppError {
  return AppError.conflict(message, [], 'AUCTION_NOT_OPEN');
}

/**
 * Registra la puja. Orden de chequeos: estado → ventana de tiempo → rango →
 * puja previa. El índice único (auction, user) es la ÚLTIMA línea de defensa
 * (dos POST simultáneos); la primera es el chequeo explícito, con mensaje claro.
 */
export async function placeBid(
  auctionId: string,
  actor: UserDocument,
  amount: number,
): Promise<BidDocument> {
  const auction = await syncLifecycle(await findAuctionOr404(auctionId));
  const now = new Date();

  if (auction.status === 'scheduled') throw notOpen('La subasta todavía no abrió');
  if (auction.status !== 'open' || now >= auction.closesAt) throw notOpen('La subasta ya cerró');
  if (now < auction.opensAt) throw notOpen('La subasta todavía no abrió');

  const object = await CursedObject.findById(auction.object).select('minBid maxBid');
  if (!object) throw AppError.internal('La subasta referencia un objeto inexistente');
  if (!Number.isInteger(amount) || amount < object.minBid || amount > object.maxBid) {
    const message = `La puja debe ser un entero entre ${object.minBid} y ${object.maxBid}`;
    throw AppError.unprocessable(message, [{ field: 'amount', value: amount, message }]);
  }

  if (await Bid.exists({ auction: auction._id, user: actor._id })) {
    throw AppError.conflict(
      'Ya pujaste en esta subasta: solo se permite una puja por usuario y no se puede modificar',
      [],
      'ALREADY_BID',
    );
  }

  const bid = await Bid.create({ auction: auction._id, user: actor._id, amount });

  // Carrera con un cierre manual: si la subasta se cerró mientras esta puja se
  // insertaba y la puja quedó DESPUÉS del corte (resolvedAt), no cuenta. Se borra
  // y se informa. Las creadas antes del corte sí entran en la resolución.
  const current = await Auction.findById(auction._id).select('status resolvedAt');
  if (
    current &&
    current.status !== 'open' &&
    current.resolvedAt &&
    bid.createdAt > current.resolvedAt
  ) {
    await bid.deleteOne();
    throw notOpen('La subasta cerró mientras se registraba la puja');
  }
  return bid;
}

/** La puja propia en esa subasta, o 404. */
export async function getMyBid(auctionId: string, actor: UserDocument): Promise<BidDocument> {
  const auction = await findAuctionOr404(auctionId);
  const bid = await Bid.findOne({ auction: auction._id, user: actor._id });
  if (!bid) throw AppError.notFound('No pujaste en esta subasta');
  return bid;
}

/**
 * Todas las pujas, reveladas. Solo con la subasta closed/cancelled: mientras esté
 * scheduled/open responde 403 (el recurso existe; lo que falta es que se cierre).
 */
export async function listRevealedBids(auctionId: string): Promise<BidDocument[]> {
  const auction = await syncLifecycle(await findAuctionOr404(auctionId));
  if (isSecret(auction.status)) {
    throw AppError.forbidden(
      'Las pujas son secretas hasta que la subasta se cierre',
      'AUCTION_STILL_SECRET',
    );
  }
  return Bid.find({ auction: auction._id })
    .populate('user', PUBLIC_USER_FIELDS)
    .sort({ amount: 1, createdAt: 1 });
}
