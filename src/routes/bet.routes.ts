import { Router } from 'express';
import { body } from 'express-validator';
import * as betController from '../controllers/bet.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { SIDE_BET_CHIPS } from '../models/SideBet.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdBody, mongoIdParam, paginationQuery } from '../utils/validators.js';

export const betRouter = Router();

betRouter.use(autenticar);

betRouter.post(
  '/',
  validate([
    mongoIdBody('auction'),
    body('targetAlias')
      .exists({ values: 'falsy' })
      .withMessage('"targetAlias" es obligatorio')
      .bail()
      .isString()
      .trim()
      .isLength({ max: 30 }),
    body('chips')
      .exists()
      .withMessage('"chips" es obligatorio')
      .bail()
      .isInt()
      .toInt()
      .isIn(SIDE_BET_CHIPS)
      .withMessage(`"chips" debe ser uno de: ${SIDE_BET_CHIPS.join(', ')}`),
  ]),
  asyncHandler(betController.place),
);
betRouter.get('/mine', validate(paginationQuery), asyncHandler(betController.mine));
betRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(betController.getById));
betRouter.delete('/:id', validate([mongoIdParam()]), asyncHandler(betController.cancel));
