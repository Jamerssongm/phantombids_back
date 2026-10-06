import { Router } from 'express';
import { body, query } from 'express-validator';
import * as auctionController from '../controllers/auction.controller.js';
import * as bidController from '../controllers/bid.controller.js';
import { autenticar, autenticarOpcional } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { AUCTION_STATUSES } from '../models/Auction.js';
import { bidRouter } from './bid.routes.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdBody, mongoIdParam, paginationQuery } from '../utils/validators.js';

export const auctionRouter = Router();

function dateField(field: 'opensAt' | 'closesAt', optional: boolean) {
  const chain = body(field);
  return (optional ? chain.optional() : chain.exists().withMessage(`"${field}" es obligatorio`))
    .isISO8601({ strict: true })
    .withMessage(`"${field}" debe ser una fecha ISO 8601, ej. 2026-10-31T20:00:00Z`)
    .toDate();
}

auctionRouter.get(
  '/',
  validate([
    ...paginationQuery,
    query('status')
      .optional()
      .isIn(AUCTION_STATUSES)
      .withMessage(`"status" debe ser uno de: ${AUCTION_STATUSES.join(', ')}`),
    query('house').optional().isMongoId().withMessage('"house" no es un identificador válido'),
    query('object').optional().isMongoId().withMessage('"object" no es un identificador válido'),
  ]),
  asyncHandler(auctionController.list),
);
auctionRouter.get(
  '/:id',
  autenticarOpcional,
  validate([mongoIdParam()]),
  asyncHandler(auctionController.getById),
);

// Permisos (miembro de la casa / creador / head_haunter / admin) en el service.
auctionRouter.post(
  '/',
  autenticar,
  validate([mongoIdBody('object'), dateField('opensAt', false), dateField('closesAt', false)]),
  asyncHandler(auctionController.create),
);
auctionRouter.put(
  '/:id',
  autenticar,
  validate([mongoIdParam(), dateField('opensAt', true), dateField('closesAt', true)]),
  asyncHandler(auctionController.update),
);
auctionRouter.delete(
  '/:id',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(auctionController.remove),
);

// head_haunter de la casa o admin (lo verifica el service: es rol de casa).
auctionRouter.post(
  '/:id/close',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(auctionController.close),
);
auctionRouter.get(
  '/:id/result',
  validate([mongoIdParam()]),
  asyncHandler(auctionController.result),
);

// Pública, también con la subasta abierta: alias de quienes pujaron, sin montos.
auctionRouter.get(
  '/:id/participants',
  validate([mongoIdParam()]),
  asyncHandler(bidController.participants),
);

auctionRouter.use('/:id/bids', bidRouter);
