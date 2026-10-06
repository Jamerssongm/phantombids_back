import jwt, { type SignOptions } from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { env } from '../config/env.js';
import { USER_ROLES, type UserRole } from '../models/User.js';

/**
 * Payload mínimo: id y rol. Nada de email, alias ni reputación: el token vive
 * horas y esos datos cambian. El rol viaja solo como referencia; autenticar
 * recarga el usuario desde la base y usa el rol vigente, no el del token.
 */
export interface TokenPayload {
  sub: string;
  role: UserRole;
}

const ALGORITHM = 'HS256';

export function signToken(payload: TokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_SECRET, {
    subject: payload.sub,
    algorithm: ALGORITHM,
    // env.ts ya validó el formato ("1d", "15m", "3600").
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
  });
}

/**
 * Verifica firma, expiración y forma del payload. Ante cualquier falla lanza un
 * error de jsonwebtoken, que el errorHandler traduce a 401.
 */
export function verifyToken(token: string): TokenPayload {
  // algorithms fijo: evita que un token firmado con otro algoritmo sea aceptado.
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
  if (
    typeof decoded !== 'object' ||
    typeof decoded.sub !== 'string' ||
    !isValidObjectId(decoded.sub) ||
    !(USER_ROLES as readonly unknown[]).includes(decoded.role)
  ) {
    throw new jwt.JsonWebTokenError('Payload del token inválido');
  }
  return { sub: decoded.sub, role: decoded.role as UserRole };
}
