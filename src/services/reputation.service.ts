/**
 * Movimientos de reputación (docs/REGLAS.md §1). La reputación nunca baja de 0.
 *
 * IDEMPOTENCIA: cada movimiento tiene una clave única (ver `reputationKey`). La
 * actualización es UN SOLO updateOne sobre el documento del usuario que, de forma
 * atómica, (a) exige que la clave no esté en `reputationEvents`, (b) aplica el
 * delta con tope en 0 y (c) agrega la clave. Aplicar el mismo movimiento dos
 * veces —un reintento tras una caída, dos procesos cerrando la misma subasta—
 * deja el mismo saldo. La atomicidad de un documento la garantiza MongoDB sin
 * transacciones. `reputationEvents` queda además como registro auditable.
 */
import type { Types } from 'mongoose';
import { User } from '../models/User.js';

type Id = Types.ObjectId | string;

/** Claves de movimiento: tipo + id del hecho que lo origina. */
export const reputationKey = {
  /** −10 por puja duplicada en esa subasta (§3). */
  duplicatePenalty: (auctionId: Id) => `penalty:${String(auctionId)}`,
  /** −N al apostar (§5). */
  betStake: (betId: Id) => `bet-stake:${String(betId)}`,
  /** +N al cancelar una apuesta (§5). */
  betRefund: (betId: Id) => `bet-refund:${String(betId)}`,
  /** +3N al ganar una apuesta (§5). */
  betPayout: (betId: Id) => `bet-payout:${String(betId)}`,
};

export const DUPLICATE_BID_PENALTY = 10;

/**
 * Aplica `delta` a la reputación del usuario si el movimiento `key` no se aplicó
 * antes. Con `requireBalance`, un descuento solo se aplica si el saldo alcanza
 * (sin tope en 0: se rechaza). Devuelve true si este llamado aplicó el movimiento.
 */
export async function applyReputationEvent(
  userId: Id,
  key: string,
  delta: number,
  { requireBalance = false }: { requireBalance?: boolean } = {},
): Promise<boolean> {
  const result = await User.updateOne(
    {
      _id: userId,
      reputationEvents: { $ne: key },
      ...(requireBalance && delta < 0 ? { reputation: { $gte: -delta } } : {}),
    },
    [
      {
        $set: {
          reputation: { $max: [0, { $add: ['$reputation', delta] }] },
          reputationEvents: { $concatArrays: [{ $ifNull: ['$reputationEvents', []] }, [key]] },
        },
      },
    ],
    { updatePipeline: true },
  );
  return result.modifiedCount === 1;
}
