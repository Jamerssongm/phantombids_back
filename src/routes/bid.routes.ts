import { Router } from 'express';
import { body } from 'express-validator';
import * as bidController from '../controllers/bid.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdParam } from '../utils/validators.js';

/** Montado en /api/auctions/:id/bids (mergeParams para leer :id de la subasta). */
export const bidRouter = Router({ mergeParams: true });

bidRouter.post(
  '/',
  autenticar,
  validate([
    mongoIdParam(),
    body('amount')
      .exists()
      .withMessage('"amount" es obligatorio')
      .bail()
      .isInt({ min: 1 })
      .withMessage('"amount" debe ser un entero positivo')
      .toInt(),
  ]),
  asyncHandler(bidController.place),
);
bidRouter.get('/mine', autenticar, validate([mongoIdParam()]), asyncHandler(bidController.mine));
// Pública: solo responde con la subasta cerrada (403 mientras sea secreta).
bidRouter.get('/', validate([mongoIdParam()]), asyncHandler(bidController.revealed));
