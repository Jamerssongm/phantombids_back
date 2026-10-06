import type { Request } from 'express';
import { User, type UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/jwt.js';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Autenticación por JWT: `Authorization: Bearer <token>`.
 *
 * El usuario se RECARGA DESDE LA BASE en cada request en vez de confiar solo en el
 * payload del token. Un token es una foto del momento del login y vive horas: si
 * en el medio un admin cambia el rol de alguien o da de baja la cuenta, confiar en
 * el payload dejaría que ese token siga operando con permisos viejos hasta vencer.
 * Recargando, el cambio de rol o la baja surten efecto en la siguiente petición.
 * El costo es una consulta por _id (indexada) por request.
 *
 * 401 si: falta el header, no es Bearer, la firma es inválida o el token expiró
 * (esos dos los traduce el errorHandler), el usuario ya no existe o está inactivo.
 */
export const autenticar = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    throw AppError.unauthorized('Falta el token de autenticación', 'MISSING_TOKEN');
  }

  const token = BEARER.exec(header)?.[1];
  if (!token) {
    throw AppError.unauthorized(
      'Formato de autorización inválido: se espera "Bearer <token>"',
      'INVALID_AUTH_HEADER',
    );
  }

  const { sub } = verifyToken(token);
  const user = await User.findById(sub);
  if (!user) {
    throw AppError.unauthorized('El usuario del token ya no existe', 'USER_NOT_FOUND');
  }
  if (!user.isActive) {
    throw AppError.unauthorized('La cuenta está desactivada', 'ACCOUNT_DISABLED');
  }

  req.user = user;
  next();
});

/**
 * Usuario autenticado en un controller montado detrás de `autenticar`.
 * Estrecha el tipo `UserDocument | undefined` sin castear: si falta, es un error
 * de configuración de la ruta y se responde 401 en vez de romper con un TypeError.
 */
export function getAuthUser(req: Pick<Request, 'user'>): UserDocument {
  if (!req.user) throw AppError.unauthorized('No autenticado');
  return req.user;
}
