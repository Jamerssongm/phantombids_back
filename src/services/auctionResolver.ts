/**
 * Resolución de una subasta inversa de PUJA ÚNICA MÁS BAJA (docs/REGLAS.md §2).
 *
 * FUNCIÓN PURA: entra un array de pujas, sale el resultado. No toca la base, no
 * importa Mongoose, no conoce req. Por eso es testeable de forma aislada
 * (tests/auctionResolver.test.ts) y reemplazable sin tocar nada más cuando
 * lleguen las reglas oficiales: quien persiste el resultado es auction.service.ts.
 *
 * Algoritmo:
 *   1. Agrupar las pujas por monto.
 *   2. Un monto es "único" si exactamente un usuario lo ofreció.
 *   3. Gana la puja única MÁS BAJA.
 *   4. Si no hay ningún monto único → cancelada, motivo "no_unique_bids".
 *   5. Si no hubo pujas → cancelada, motivo "no_bids".
 * Toda puja con monto repetido queda marcada como duplicada y su usuario se
 * penaliza (§3), haya ganador o no.
 */

export interface ResolverBid {
  bidId: string;
  userId: string;
  amount: number;
}

export type ResolverCancellationReason = 'no_unique_bids' | 'no_bids';

export interface ResolutionResult {
  status: 'closed' | 'cancelled';
  /** Puja ganadora, o null si la subasta se cancela. */
  winner: ResolverBid | null;
  winningAmount: number | null;
  /** Ids de todas las pujas con monto repetido, ordenados por monto y luego id. */
  duplicateBidIds: string[];
  /** Usuarios con alguna puja duplicada, sin repetir y ordenados. */
  penalizedUserIds: string[];
  cancellationReason: ResolverCancellationReason | null;
}

export function resolveAuction(bids: readonly ResolverBid[]): ResolutionResult {
  if (bids.length === 0) {
    return {
      status: 'cancelled',
      winner: null,
      winningAmount: null,
      duplicateBidIds: [],
      penalizedUserIds: [],
      cancellationReason: 'no_bids',
    };
  }

  // 1. Agrupar por monto.
  const byAmount = new Map<number, ResolverBid[]>();
  for (const bid of bids) {
    const group = byAmount.get(bid.amount);
    if (group) group.push(bid);
    else byAmount.set(bid.amount, [bid]);
  }

  // Montos de menor a mayor: el orden determina el ganador y hace la salida determinista.
  const amounts = [...byAmount.keys()].sort((a, b) => a - b);

  // 2 y 3. El primer monto único recorriendo de menor a mayor es el ganador.
  const winningAmount = amounts.find((amount) => byAmount.get(amount)!.length === 1) ?? null;
  const winner = winningAmount === null ? null : byAmount.get(winningAmount)![0]!;

  const duplicates = amounts
    .filter((amount) => byAmount.get(amount)!.length > 1)
    .flatMap((amount) => [...byAmount.get(amount)!].sort((a, b) => a.bidId.localeCompare(b.bidId)));

  return {
    // 4. Sin montos únicos, cancelada.
    status: winner ? 'closed' : 'cancelled',
    winner,
    winningAmount,
    duplicateBidIds: duplicates.map((bid) => bid.bidId),
    penalizedUserIds: [...new Set(duplicates.map((bid) => bid.userId))].sort(),
    cancellationReason: winner ? null : 'no_unique_bids',
  };
}
