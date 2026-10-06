import { rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Límite por IP con respuesta en el formato del proyecto (429 vía errorHandler).
 * Store en memoria: suficiente para una sola instancia en Render. Con varias
 * instancias haría falta un store compartido (Redis).
 */
function limiter(limit: number, message: string, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, _res, next) => next(AppError.tooManyRequests(message)),
    ...extra,
  });
}

/** Login: 10 intentos FALLIDOS por IP cada 15 minutos (los exitosos no cuentan). */
export const loginLimiter = limiter(
  10,
  'Demasiados intentos de inicio de sesión. Probá de nuevo en 15 minutos.',
  { skipSuccessfulRequests: true },
);

/** Registro: 10 cuentas por IP cada 15 minutos. */
export const registerLimiter = limiter(
  10,
  'Demasiados registros desde esta conexión. Probá de nuevo en 15 minutos.',
);
