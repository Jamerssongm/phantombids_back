import { Router } from 'express';
import { query } from 'express-validator';
import * as rankingController from '../controllers/ranking.controller.js';
import { validate } from '../middlewares/validate.js';
import { RANKING_TYPES } from '../services/ranking.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginationQuery } from '../utils/validators.js';

export const rankingRouter = Router();

// Pública: los rankings solo exponen alias, nombre visible y avatar.
/**
 * @openapi
 * /api/rankings:
 *   get:
 *     tags:
 *     - Rankings
 *     summary: Ranking por tipo
 *     description: Calculado con pipelines de agregación. Excluye usuarios dados de baja. betting-prophet
 *       exige al menos 3 apuestas resueltas. Métricas en REGLAS.md §6.
 *     parameters:
 *     - name: type
 *       in: query
 *       schema:
 *         type: string
 *         enum:
 *         - worst-bidder
 *         - total-cursed
 *         - free-spirit
 *         - betting-prophet
 *       required: true
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/RankingEntryPage'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
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
