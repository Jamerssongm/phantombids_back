import { Router } from 'express';
import { query } from 'express-validator';
import * as rankingController from '../controllers/ranking.controller.js';
import { validate } from '../middlewares/validate.js';
import { RANKING_TYPES } from '../services/ranking.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationQuery } from '../utils/validators.js';

export const rankingRouter = Router();

// Pública: los rankings solo exponen alias, nombre visible y avatar.
rankingRouter.get(
  '/',
  validate([
    ...paginationQuery,
    query('type')
      .exists()
      .withMessage(`"type" es obligatorio: ${RANKING_TYPES.join(', ')}`)
      .bail()
      .isIn(RANKING_TYPES)
      .withMessage(`"type" debe ser uno de: ${RANKING_TYPES.join(', ')}`),
  ]),
  asyncHandler(rankingController.get),
);
