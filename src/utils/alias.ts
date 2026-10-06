import { randomInt } from 'node:crypto';
import { User } from '../models/User.js';
import { AppError } from './AppError.js';

/**
 * Mismo banco que el frontend (phantombids/src/lib/alias.ts) para que ambos lados
 * generen alias del mismo estilo. Sin tildes: el patrón del modelo es ASCII.
 */
export const ALIAS_ADJECTIVES = [
  'Sombrio',
  'Errante',
  'Nebuloso',
  'Umbral',
  'Gelido',
  'Silente',
  'Nocturno',
  'Fantasmal',
  'Etereo',
  'Crepuscular',
  'Espectral',
  'Difunto',
] as const;

/** 12 adjetivos × 900 números = 10 800 alias posibles. */
const MAX_ATTEMPTS = 10;

/** Alias aleatorio [Adjetivo]_[Número], número de 3 dígitos (100–999). */
export function randomAlias(): string {
  const adjective = ALIAS_ADJECTIVES[randomInt(ALIAS_ADJECTIVES.length)];
  return `${adjective}_${randomInt(100, 1000)}`;
}

/**
 * Genera un alias que todavía no existe en la base. Reintenta ante colisión y,
 * si se agota el tope, falla con un error claro en vez de quedar en un bucle.
 */
export async function generateUniqueAlias(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const alias = randomAlias();
    if (!(await User.exists({ alias }))) return alias;
  }
  throw AppError.internal(
    `No se pudo generar un alias único tras ${MAX_ATTEMPTS} intentos; probá de nuevo`,
    'ALIAS_GENERATION_FAILED',
  );
}
