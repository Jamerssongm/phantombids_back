/**
 * Rankings (docs/REGLAS.md §6), calculados con PIPELINES DE AGREGACIÓN de MongoDB.
 *
 * Por qué agregación y no find() + sort en JavaScript: el conteo, el filtro de
 * usuarios activos, el orden y la paginación los resuelve la base, sobre los
 * índices, y al servidor solo viaja la página pedida. Cargar las colecciones de
 * pujas o apuestas en memoria para contarlas escala con el tamaño de la
 * historia; esto escala con el tamaño de la página.
 *
 * Todos los pipelines comparten la misma estructura:
 *   1. $match  → filtrar los documentos que cuentan para la métrica
 *   2. $group  → un documento por usuario con su valor
 *   3. $lookup → traer los datos públicos del usuario
 *   4. $match  → excluir usuarios dados de baja (isActive: false)
 *   5. $sort   → por valor descendente; empate por alias (orden estable)
 *   6. $facet  → en una sola consulta, la página pedida y el total para meta
 */
import type { PipelineStage } from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { SideBet } from '../models/SideBet.js';
import { User } from '../models/User.js';
import { UserCurse } from '../models/UserCurse.js';
import type { Pagination } from '../utils/pagination.js';

export const RANKING_TYPES = [
  'worst-bidder',
  'total-cursed',
  'free-spirit',
  'betting-prophet',
] as const;
export type RankingType = (typeof RANKING_TYPES)[number];

/** Mínimo de apuestas resueltas para aparecer en Betting Prophet (§6). */
export const PROPHET_MIN_RESOLVED = 3;

interface RawRankingRow {
  _id: unknown;
  value: number;
  won?: number;
  resolved?: number;
  user: { _id: unknown; alias: string; displayName: string; avatarUrl?: string };
}

/** Resultado del $facet: la página y el total. */
interface RankingFacet {
  items: RawRankingRow[];
  total: { count: number }[];
}

/** Pasos 3 a 6, comunes a todos los rankings. */
function userAndPageStages({ skip, limit }: Pagination): PipelineStage[] {
  return [
    {
      $lookup: {
        from: User.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { alias: 1, displayName: 1, avatarUrl: 1, isActive: 1 } }],
      },
    },
    { $unwind: '$user' },
    { $match: { 'user.isActive': true } },
    { $sort: { value: -1, 'user.alias': 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ];
}

/**
 * WORST BIDDER — cuántas pujas duplicadas hizo cada usuario.
 * Parte de `bids`: solo las marcadas isDuplicate (las marca la liquidación del
 * cierre, así que no incluye subastas abiertas) y cuenta por usuario.
 */
function worstBidder(page: Pagination) {
  return Bid.aggregate<RankingFacet>([
    { $match: { isDuplicate: true } },
    { $group: { _id: '$user', value: { $sum: 1 } } },
    ...userAndPageStages(page),
  ]);
}

/**
 * TOTAL CURSED — cuántas maldiciones recibió cada usuario en toda su historia.
 * Parte de `usercurses` sin filtrar por estado: cuentan activas, cumplidas y vencidas.
 */
function totalCursed(page: Pagination) {
  return UserCurse.aggregate<RankingFacet>([
    { $group: { _id: '$user', value: { $sum: 1 } } },
    ...userAndPageStages(page),
  ]);
}

/**
 * FREE SPIRIT — participaciones limpias: subastas ya liquidadas en las que el
 * usuario pujó y su puja NO quedó duplicada (interpretación en REGLAS.md §6).
 * Parte de `bids` no duplicadas y, con un $lookup sobre `auctions`, descarta las
 * de subastas que todavía no se liquidaron (abiertas o a medio cerrar).
 */
function freeSpirit(page: Pagination) {
  return Bid.aggregate<RankingFacet>([
    { $match: { isDuplicate: false } },
    {
      $lookup: {
        from: Auction.collection.name,
        localField: 'auction',
        foreignField: '_id',
        as: 'settled',
        pipeline: [
          { $match: { status: { $in: ['closed', 'cancelled'] }, settledAt: { $exists: true } } },
          { $project: { _id: 1 } },
        ],
      },
    },
    { $match: { 'settled.0': { $exists: true } } },
    { $group: { _id: '$user', value: { $sum: 1 } } },
    ...userAndPageStages(page),
  ]);
}

/**
 * BETTING PROPHET — tasa de acierto: ganadas ÷ resueltas.
 * Parte de `sidebets` resueltas (won/lost; pending y cancelled no cuentan),
 * agrupa por apostador contando resueltas y ganadas, exige un mínimo de
 * PROPHET_MIN_RESOLVED resueltas (sin él, una sola apuesta acertada daría 100% y
 * encabezaría el tablero) y calcula la tasa en la propia base.
 */
function bettingProphet(page: Pagination) {
  return SideBet.aggregate<RankingFacet>([
    { $match: { result: { $in: ['won', 'lost'] } } },
    {
      $group: {
        _id: '$bettor',
        resolved: { $sum: 1 },
        won: { $sum: { $cond: [{ $eq: ['$result', 'won'] }, 1, 0] } },
      },
    },
    { $match: { resolved: { $gte: PROPHET_MIN_RESOLVED } } },
    { $addFields: { value: { $round: [{ $divide: ['$won', '$resolved'] }, 4] } } },
    ...userAndPageStages(page),
  ]);
}

const PIPELINES: Record<RankingType, (page: Pagination) => PromiseLike<RankingFacet[]>> = {
  'worst-bidder': worstBidder,
  'total-cursed': totalCursed,
  'free-spirit': freeSpirit,
  'betting-prophet': bettingProphet,
};

export interface RankingEntry {
  rank: number;
  user: { id: string; alias: string; displayName: string; avatarUrl?: string };
  value: number;
  won?: number;
  resolved?: number;
}

/**
 * Serializador explícito: aggregate devuelve objetos crudos (sin el toJSON de los
 * modelos), así que se arma la forma pública a mano. Nunca sale el email.
 */
function toEntry(row: RawRankingRow, index: number, skip: number): RankingEntry {
  return {
    rank: skip + index + 1,
    user: {
      id: String(row.user._id),
      alias: row.user.alias,
      displayName: row.user.displayName,
      ...(row.user.avatarUrl ? { avatarUrl: row.user.avatarUrl } : {}),
    },
    value: row.value,
    ...(row.resolved !== undefined ? { won: row.won, resolved: row.resolved } : {}),
  };
}

export async function getRanking(
  type: RankingType,
  page: Pagination,
): Promise<{ items: RankingEntry[]; total: number }> {
  const [result] = await PIPELINES[type](page);
  return {
    items: (result?.items ?? []).map((row, i) => toEntry(row, i, page.skip)),
    total: result?.total[0]?.count ?? 0,
  };
}
