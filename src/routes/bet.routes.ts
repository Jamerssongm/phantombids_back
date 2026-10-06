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

/**
 * @openapi
 * /api/bets:
 *   post:
 *     tags:
 *     - Bets
 *     summary: Apostar por quién gana
 *     description: Subasta open; fichas 5/10/25/50, que se descuentan de la reputación al apostar (409 si
 *       no alcanza); el alias objetivo debe haber pujado y no ser uno mismo (422); una apuesta por subasta
 *       (409). Paga 3× si gana.
 *     security:
 *     - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auction:
 *                 type: string
 *                 pattern: ^[a-f0-9]{24}$
 *               targetAlias:
 *                 type: string
 *                 example: Nebuloso_207
 *               chips:
 *                 type: integer
 *                 enum:
 *                 - 5
 *                 - 10
 *                 - 25
 *                 - 50
 *             required:
 *             - auction
 *             - targetAlias
 *             - chips
 *     responses:
 *       201:
 *         $ref: '#/components/responses/SideBetCreated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
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
/**
 * @openapi
 * /api/bets/mine:
 *   get:
 *     tags:
 *     - Bets
 *     summary: Mis apuestas con su resultado
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/SideBetPage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
betRouter.get('/mine', validate(paginationQuery), asyncHandler(betController.mine));
/**
 * @openapi
 * /api/bets/{id}:
 *   get:
 *     tags:
 *     - Bets
 *     summary: Una apuesta
 *     description: Dueño o admin.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/SideBetOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
betRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(betController.getById));
/**
 * @openapi
 * /api/bets/{id}:
 *   delete:
 *     tags:
 *     - Bets
 *     summary: Cancelar una apuesta
 *     description: Dueño o admin, solo mientras la subasta siga open. Devuelve las fichas. 409 si ya cerró.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       204:
 *         $ref: '#/components/responses/NoContent'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
betRouter.delete('/:id', validate([mongoIdParam()]), asyncHandler(betController.cancel));
