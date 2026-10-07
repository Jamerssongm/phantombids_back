import type { RequestHandler } from 'express';
import type { UserRole } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Autorización por rol GLOBAL (User.role). Se monta SIEMPRE después de `autenticar`:
 *
 *   router.delete('/:id', autenticar, autorizar('admin'), controller)
 *   router.get('/', autenticar, autorizar('admin', 'user'), controller)
 *
 * No mira los roles de casa (HouseMembership.houseRole): esos son por casa y los
 * resuelve cada service.
 */
export function autorizar(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      // Si pasa esto, la ruta se montó sin `autenticar` antes: es un bug de configuración.
      logger.warn(
        `autorizar(${roles.join(', ')}) sin req.user en ${req.method} ${req.originalUrl}: ` +
          'falta montar autenticar antes',
      );
      next(AppError.unauthorized('No autenticado'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(
        AppError.forbidden(
          `Esta acción requiere uno de estos roles: ${roles.join(', ')}`,
          'FORBIDDEN_ROLE',
        ),
      );
      return;
    }
    next();
  };
}
