import { describe, expect, it } from 'vitest';
import { resolveAuction, type ResolverBid } from '../src/services/auctionResolver.js';

/** Pujas a partir de [usuario, monto]; el bidId es b<posición>. */
function bids(...entries: [user: string, amount: number][]): ResolverBid[] {
  return entries.map(([userId, amount], i) => ({ bidId: `b${i + 1}`, userId, amount }));
}

describe('resolveAuction — puja única más baja', () => {
  it('ganador normal con varios montos únicos: gana el único más bajo', () => {
    const result = resolveAuction(bids(['ana', 40], ['beto', 25], ['caro', 90], ['dani', 31]));

    expect(result.status).toBe('closed');
    expect(result.winner).toEqual({ bidId: 'b2', userId: 'beto', amount: 25 });
    expect(result.winningAmount).toBe(25);
    expect(result.duplicateBidIds).toEqual([]);
    expect(result.penalizedUserIds).toEqual([]);
    expect(result.cancellationReason).toBeNull();
  });

  it('ejemplo de REGLAS.md §2: [12, 15, 15, 18, 20, 20, 23] → gana 12 y se penaliza a 4', () => {
    const result = resolveAuction(
      bids(['u1', 12], ['u2', 15], ['u3', 15], ['u4', 18], ['u5', 20], ['u6', 20], ['u7', 23]),
    );

    expect(result.winner?.userId).toBe('u1');
    expect(result.winningAmount).toBe(12);
    expect(result.duplicateBidIds).toEqual(['b2', 'b3', 'b5', 'b6']);
    expect(result.penalizedUserIds).toEqual(['u2', 'u3', 'u5', 'u6']);
  });

  it('todos los montos duplicados → cancelada por no_unique_bids y todos penalizados', () => {
    const result = resolveAuction(bids(['a', 15], ['b', 15], ['c', 20], ['d', 20]));

    expect(result.status).toBe('cancelled');
    expect(result.cancellationReason).toBe('no_unique_bids');
    expect(result.winner).toBeNull();
    expect(result.winningAmount).toBeNull();
    expect(result.duplicateBidIds).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(result.penalizedUserIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sin pujas → cancelada por no_bids, sin penalizados', () => {
    const result = resolveAuction([]);

    expect(result.status).toBe('cancelled');
    expect(result.cancellationReason).toBe('no_bids');
    expect(result.winner).toBeNull();
    expect(result.duplicateBidIds).toEqual([]);
    expect(result.penalizedUserIds).toEqual([]);
  });

  it('una sola puja → esa gana', () => {
    const result = resolveAuction(bids(['solo', 73]));

    expect(result.status).toBe('closed');
    expect(result.winner).toEqual({ bidId: 'b1', userId: 'solo', amount: 73 });
    expect(result.penalizedUserIds).toEqual([]);
  });

  it('EL CASO CLAVE: el monto más bajo está duplicado y el segundo más bajo es único → gana el segundo', () => {
    // Una implementación ingenua ("gana el más bajo") daría ganador a 10.
    const result = resolveAuction(bids(['a', 10], ['b', 10], ['c', 11], ['d', 50]));

    expect(result.status).toBe('closed');
    expect(result.winner).toEqual({ bidId: 'b3', userId: 'c', amount: 11 });
    expect(result.winningAmount).toBe(11);
    expect(result.duplicateBidIds).toEqual(['b1', 'b2']);
    expect(result.penalizedUserIds).toEqual(['a', 'b']);
  });

  it('varios montos bajos duplicados seguidos: salta todos hasta el primer único', () => {
    const result = resolveAuction(
      bids(['a', 5], ['b', 5], ['c', 6], ['d', 6], ['e', 7], ['f', 9], ['g', 8]),
    );

    expect(result.winner?.userId).toBe('e');
    expect(result.winningAmount).toBe(7);
  });

  describe('montos en los bordes exactos de [minBid, maxBid]', () => {
    // Rango del objeto: [50, 400]. El resolvedor no conoce el rango (lo valida
    // bid.service al pujar); acá se verifica que los extremos se traten igual que
    // cualquier otro monto.
    it('una puja única en minBid gana', () => {
      const result = resolveAuction(bids(['min', 50], ['max', 400], ['mid', 200]));
      expect(result.winner?.userId).toBe('min');
      expect(result.winningAmount).toBe(50);
    });

    it('minBid duplicado y maxBid único: gana maxBid', () => {
      const result = resolveAuction(bids(['a', 50], ['b', 50], ['c', 400]));
      expect(result.winner?.userId).toBe('c');
      expect(result.winningAmount).toBe(400);
      expect(result.penalizedUserIds).toEqual(['a', 'b']);
    });

    it('ambos bordes duplicados → cancelada', () => {
      const result = resolveAuction(bids(['a', 50], ['b', 50], ['c', 400], ['d', 400]));
      expect(result.status).toBe('cancelled');
      expect(result.cancellationReason).toBe('no_unique_bids');
    });
  });

  it('tres usuarios con el mismo monto: los tres duplicados y penalizados', () => {
    const result = resolveAuction(bids(['a', 30], ['b', 30], ['c', 30], ['d', 45]));

    expect(result.winner?.userId).toBe('d');
    expect(result.duplicateBidIds).toEqual(['b1', 'b2', 'b3']);
    expect(result.penalizedUserIds).toEqual(['a', 'b', 'c']);
  });

  it('solo tres pujas iguales → cancelada con los tres penalizados', () => {
    const result = resolveAuction(bids(['a', 30], ['b', 30], ['c', 30]));

    expect(result.status).toBe('cancelled');
    expect(result.penalizedUserIds).toEqual(['a', 'b', 'c']);
  });

  it('es determinista: el orden de entrada no cambia el resultado', () => {
    const input = bids(['a', 10], ['b', 10], ['c', 11], ['d', 12], ['e', 12]);
    const shuffled = [input[3]!, input[0]!, input[4]!, input[2]!, input[1]!];

    expect(resolveAuction(shuffled)).toEqual(resolveAuction(input));
  });

  it('no muta la entrada', () => {
    const input = bids(['a', 10], ['b', 10], ['c', 11]);
    const copy = structuredClone(input);
    resolveAuction(input);
    expect(input).toEqual(copy);
  });
});
