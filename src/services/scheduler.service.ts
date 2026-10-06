/**
 * Proceso periódico del ciclo de vida de las subastas (docs/REGLAS.md §2b).
 * Cada pasada:
 *   1. abre las subastas scheduled cuyo opensAt ya pasó;
 *   2. cierra y liquida las open cuyo closesAt ya pasó;
 *   3. completa cierres que quedaron a mitad (sin settledAt), por ejemplo si el
 *      proceso murió en medio de una liquidación;
 *   4. vence las maldiciones activas cuyo expiresAt ya pasó.
 * Todo es idempotente (ver auction.service.ts), así que una pasada que se cruce
 * con un cierre manual o con un acceso perezoso no duplica efectos.
 *
 * No se solapa consigo mismo: si una pasada sigue corriendo cuando llega el
 * siguiente tick, ese tick se saltea. Se desactiva con AUTO_CLOSE_ENABLED=false.
 */
import { Auction } from '../models/Auction.js';
import { UserCurse } from '../models/UserCurse.js';
import { resolveAuctionById, settleAuction } from './auction.service.js';

const DEFAULT_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | undefined;
let currentPass: Promise<void> | undefined;

export interface PassSummary {
  opened: number;
  resolved: number;
  recovered: number;
  expiredCurses: number;
}

export async function runSchedulerPass(): Promise<PassSummary> {
  const now = new Date();

  const { modifiedCount: opened } = await Auction.updateMany(
    { status: 'scheduled', opensAt: { $lte: now } },
    { $set: { status: 'open' } },
  );

  let resolved = 0;
  const due = await Auction.find({ status: 'open', closesAt: { $lte: now } })
    .select('_id')
    .sort({ closesAt: 1 });
  for (const { _id } of due) {
    if (await resolveAuctionById(_id)) resolved++;
  }

  const unsettled = await Auction.find({
    status: { $in: ['closed', 'cancelled'] },
    settledAt: { $exists: false },
  }).sort({ resolvedAt: 1 });
  for (const auction of unsettled) await settleAuction(auction);

  const { modifiedCount: expiredCurses } = await UserCurse.updateMany(
    { status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } },
  );

  return { opened, resolved, recovered: unsettled.length, expiredCurses };
}

async function tick(): Promise<void> {
  if (currentPass) {
    console.warn('⏱️  Scheduler: la pasada anterior sigue en curso, se saltea este tick');
    return;
  }
  currentPass = (async () => {
    try {
      const s = await runSchedulerPass();
      if (s.opened || s.resolved || s.recovered || s.expiredCurses) {
        console.log(
          `⏱️  Scheduler: ${s.opened} abierta(s), ${s.resolved} cerrada(s), ` +
            `${s.recovered} cierre(s) completado(s), ${s.expiredCurses} maldición(es) vencida(s)`,
        );
      }
    } catch (error) {
      console.error('❌ Scheduler: la pasada falló', error);
    } finally {
      currentPass = undefined;
    }
  })();
  await currentPass;
}

/** Arranca el scheduler: una pasada inmediata (recupera lo vencido mientras dormía) y luego cada intervalo. */
export function startAuctionScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return;
  console.log(`⏱️  Scheduler de subastas activo (cada ${intervalMs / 1000} s)`);
  void tick();
  timer = setInterval(() => void tick(), intervalMs);
}

/** Detiene el scheduler y espera a que termine la pasada en curso, si la hay. */
export async function stopAuctionScheduler(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  if (currentPass) {
    console.log('⏱️  Scheduler: esperando que termine la pasada en curso...');
    await currentPass;
  }
}
