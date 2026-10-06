import { Router } from 'express';
import { body } from 'express-validator';
import * as membershipController from '../controllers/membership.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { HOUSE_ROLES } from '../models/HouseMembership.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdBody, mongoIdParam } from '../utils/validators.js';

/** Montado en /api/houses/:id/members (mergeParams para leer :id de la casa). */
export const membershipRouter = Router({ mergeParams: true });

const roleMessage = `"houseRole" debe ser uno de: ${HOUSE_ROLES.join(', ')}`;

membershipRouter.get('/', validate([mongoIdParam()]), asyncHandler(membershipController.list));

// Permisos (head_haunter o admin; salirse uno mismo) los resuelve el service.
membershipRouter.post(
  '/',
  autenticar,
  validate([
    mongoIdParam(),
    mongoIdBody('userId'),
    body('houseRole').optional().isIn(HOUSE_ROLES).withMessage(roleMessage),
  ]),
  asyncHandler(membershipController.add),
);
membershipRouter.put(
  '/:userId',
  autenticar,
  validate([
    mongoIdParam(),
    mongoIdParam('userId'),
    body('houseRole')
      .exists()
      .withMessage('"houseRole" es obligatorio')
      .bail()
      .isIn(HOUSE_ROLES)
      .withMessage(roleMessage),
  ]),
  asyncHandler(membershipController.updateRole),
);
membershipRouter.delete(
  '/:userId',
  autenticar,
  validate([mongoIdParam(), mongoIdParam('userId')]),
  asyncHandler(membershipController.remove),
);
