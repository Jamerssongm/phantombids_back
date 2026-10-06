import { Router } from 'express';
import { body, query } from 'express-validator';
import * as userController from '../controllers/user.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validate } from '../middlewares/validate.js';
import { USER_ROLES } from '../models/User.js';
import { USER_CURSE_STATUSES } from '../models/UserCurse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdParam, paginationQuery, trimmedString } from '../utils/validators.js';

export const userRouter = Router();

// Todas las rutas de usuarios requieren sesión.
userRouter.use(autenticar);

userRouter.get(
  '/',
  autorizar('admin'),
  validate([
    ...paginationQuery,
    query('role')
      .optional()
      .isIn(USER_ROLES)
      .withMessage(`"role" debe ser uno de: ${USER_ROLES.join(', ')}`),
    query('alias').optional().isString().trim().isLength({ max: 30 }),
    query('isActive').optional().isBoolean().withMessage('"isActive" debe ser true o false'),
  ]),
  asyncHandler(userController.list),
);

userRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(userController.getById));

// Dueño o admin (lo verifica el service).
userRouter.get(
  '/:id/curses',
  validate([
    mongoIdParam(),
    query('status')
      .optional()
      .isIn(USER_CURSE_STATUSES)
      .withMessage(`"status" debe ser uno de: ${USER_CURSE_STATUSES.join(', ')}`),
  ]),
  asyncHandler(userController.curses),
);

// Dueño o admin: lo resuelve el service (la propiedad no es un rol global).
userRouter.put(
  '/:id',
  validate([
    mongoIdParam(),
    trimmedString('displayName', { min: 3, max: 50, optional: true }),
    body('avatarUrl')
      .optional({ values: 'null' })
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('El avatar debe ser una URL http(s) válida'),
    body('role')
      .optional()
      .isIn(USER_ROLES)
      .withMessage(`"role" debe ser uno de: ${USER_ROLES.join(', ')}`),
    body('isActive')
      .optional()
      .isBoolean({ strict: true })
      .withMessage('"isActive" debe ser booleano'),
  ]),
  asyncHandler(userController.update),
);

userRouter.delete(
  '/:id',
  autorizar('admin'),
  validate([mongoIdParam()]),
  asyncHandler(userController.remove),
);
