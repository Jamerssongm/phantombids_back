import { Router } from 'express';
import { body } from 'express-validator';
import * as bidController from '../controllers/bid.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdParam } from '../utils/validators.js';

/** Montado en /api/auctions/:id/bids (mergeParams para leer :id de la subasta). */
export const bidRouter = Router({ mergeParams: true });

/**
 * @openapi
 * /api/auctions/{id}/bids:
 *   post:
 *     tags:
 *     - Bids
 *     summary: Pujar
 *     description: Subasta open y dentro de [opensAt, closesAt); monto entero en [minBid, maxBid] del objeto;
 *       una sola puja por usuario (409). La respuesta solo confirma la puja propia.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 example: 77
 *             required:
 *             - amount
 *     responses:
 *       201:
 *         $ref: '#/components/responses/BidCreated'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
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
/**
 * @openapi
 * /api/auctions/{id}/bids/mine:
 *   get:
 *     tags:
 *     - Bids
 *     summary: Mi puja en esta subasta
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/BidOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
bidRouter.get('/mine', autenticar, validate([mongoIdParam()]), asyncHandler(bidController.mine));
// Pública: solo responde con la subasta cerrada (403 mientras sea secreta).
/**
 * @openapi
 * /api/auctions/{id}/bids:
 *   get:
 *     tags:
 *     - Bids
 *     summary: Todas las pujas, reveladas
 *     description: Solo con la subasta closed/cancelled. Mientras siga secreta responde **403** (el recurso
 *       existe; falta que se cierre).
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/RevealedBidList'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
bidRouter.get('/', validate([mongoIdParam()]), asyncHandler(bidController.revealed));
