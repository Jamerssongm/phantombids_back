import type { RequestHandler } from 'express';
import { validationResult, type ValidationChain, type ValidationError } from 'express-validator';
import { AppError, type ErrorDetail } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const SENSITIVE_FIELD = /password|token|secret/i;

function toDetail(error: ValidationError): ErrorDetail {
  if (error.type !== 'field') return { message: String(error.msg) };
  return {
    field: error.path,
    location: error.location,
    // Nunca se devuelve una contraseña, ni siquiera la que mandó el propio cliente.
    value: SENSITIVE_FIELD.test(error.path) ? '[oculto]' : error.value,
    message: String(error.msg),
  };
}

/**
 * Único punto de entrada para validar requests con express-validator:
 *
 *   router.post('/', validate([body('name').trim().notEmpty()]), asyncHandler(controller))
 *
 * Corre todas las cadenas (incluidos sus sanitizadores) y, si algo falla, lanza:
 * - 400 si TODOS los errores son de parámetros de ruta (ej. un id mal formado en
 *   la URL: la petición en sí está mal dirigida, igual que un CastError);
 * - 422 en cualquier otro caso (body o query con datos inválidos).
 */
export function validate(chains: ValidationChain[]): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    for (const chain of chains) await chain.run(req);

    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length === 0) {
      next();
      return;
    }

    const details = errors.map(toDetail);
    if (details.every((d) => d.location === 'params')) {
      throw AppError.badRequest('Parámetros de ruta inválidos', details, 'INVALID_PARAMS');
    }
    throw AppError.unprocessable('Los datos enviados no son válidos', details);
  });
}
