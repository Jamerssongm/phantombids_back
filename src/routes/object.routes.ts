import { Router } from 'express';
import { body, query } from 'express-validator';
import * as objectController from '../controllers/object.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  mongoIdBody,
  mongoIdParam,
  optionalUrl,
  paginationQuery,
  trimmedString,
} from '../utils/validators.js';

export const objectRouter = Router();

function bidField(field: 'minBid' | 'maxBid', optional: boolean) {
  const chain = body(field);
  return (optional ? chain.optional() : chain.exists().withMessage(`"${field}" es obligatorio`))
    .isInt({ min: 1 })
    .withMessage(`"${field}" debe ser un entero mayor o igual a 1`)
    .toInt();
}

objectRouter.get(
  '/',
  validate([
    ...paginationQuery,
    query('house').optional().isMongoId().withMessage('"house" no es un identificador válido'),
    query('curse').optional().isMongoId().withMessage('"curse" no es un identificador válido'),
  ]),
  asyncHandler(objectController.list),
);
objectRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(objectController.getById));

// Membresía de la casa, creador y head_haunter: lo verifica el service.
objectRouter.post(
  '/',
  autenticar,
  validate([
    trimmedString('name', { min: 3, max: 80 }),
    optionalUrl('imageUrl'),
    mongoIdBody('house'),
    mongoIdBody('curse'),
    bidField('minBid', false),
    bidField('maxBid', false),
  ]),
  asyncHandler(objectController.create),
);
objectRouter.put(
  '/:id',
  autenticar,
  validate([
    mongoIdParam(),
    trimmedString('name', { min: 3, max: 80, optional: true }),
    optionalUrl('imageUrl'),
    mongoIdBody('curse', { optional: true }),
    bidField('minBid', true),
    bidField('maxBid', true),
  ]),
  asyncHandler(objectController.update),
);
objectRouter.delete(
  '/:id',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(objectController.remove),
);
