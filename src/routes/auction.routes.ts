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

/**
 * @openapi
 * /api/auctions:
 *   get:
 *     tags:
 *     - Auctions
 *     summary: Listar subastas
 *     parameters:
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 *     - name: status
 *       in: query
 *       schema:
 *         type: string
 *         enum:
 *         - scheduled
 *         - open
 *         - closed
 *         - cancelled
 *     - name: house
 *       in: query
 *       schema:
 *         type: string
 *         pattern: ^[a-f0-9]{24}$
 *     - name: object
 *       in: query
 *       schema:
 *         type: string
 *         pattern: ^[a-f0-9]{24}$
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AuctionPage'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
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
/**
 * @openapi
 * /api/auctions/{id}:
 *   get:
 *     tags:
 *     - Auctions
 *     summary: Detalle de una subasta
 *     description: Pública. **Secreto de las pujas:** mientras esté scheduled/open, la respuesta no contiene
 *       montos ajenos ni cantidad de pujas; con token, incluye solo la puja propia en `myBid`. Un token
 *       presente pero inválido da 401.
 *     security:
 *     - {}
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AuctionDetailOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
auctionRouter.get(
  '/:id',
  autenticarOpcional,
  validate([mongoIdParam()]),
  asyncHandler(auctionController.getById),
);

// Permisos (miembro de la casa / creador / head_haunter / admin) en el service.
/**
 * @openapi
 * /api/auctions:
 *   post:
 *     tags:
 *     - Auctions
 *     summary: Crear una subasta
 *     description: Miembro de la casa del objeto o admin. closesAt > opensAt > ahora. 409 si el objeto ya
 *       tiene una subasta programada o abierta.
 *     security:
 *     - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuctionInput'
 *     responses:
 *       201:
 *         $ref: '#/components/responses/AuctionCreated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
auctionRouter.post(
  '/',
  autenticar,
  validate([mongoIdBody('object'), dateField('opensAt', false), dateField('closesAt', false)]),
  asyncHandler(auctionController.create),
);
/**
 * @openapi
 * /api/auctions/{id}:
 *   put:
 *     tags:
 *     - Auctions
 *     summary: Reprogramar una subasta
 *     description: Creador, head_haunter o admin. Solo si está scheduled (409 si no).
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               opensAt:
 *                 type: string
 *                 format: date-time
 *               closesAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AuctionOk'
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
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
auctionRouter.put(
  '/:id',
  autenticar,
  validate([mongoIdParam(), dateField('opensAt', true), dateField('closesAt', true)]),
  asyncHandler(auctionController.update),
);
/**
 * @openapi
 * /api/auctions/{id}:
 *   delete:
 *     tags:
 *     - Auctions
 *     summary: Borrar una subasta
 *     description: Creador, head_haunter o admin. Solo scheduled y sin pujas.
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
auctionRouter.delete(
  '/:id',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(auctionController.remove),
);

// head_haunter de la casa o admin (lo verifica el service: es rol de casa).
/**
 * @openapi
 * /api/auctions/{id}/close:
 *   post:
 *     tags:
 *     - Auctions
 *     summary: Cerrar una subasta manualmente
 *     description: head_haunter de la casa o admin. Resuelve la subasta (puja única más baja), marca duplicados,
 *       penaliza, liquida apuestas y devuelve el resultado. 409 si ya está cerrada (sin repetir efectos).
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AuctionResultOk'
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
auctionRouter.post(
  '/:id/close',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(auctionController.close),
);
/**
 * @openapi
 * /api/auctions/{id}/result:
 *   get:
 *     tags:
 *     - Auctions
 *     summary: Resultado completo de una subasta
 *     description: Ganador, todas las pujas reveladas con duplicados marcados, penalizaciones y resumen
 *       de apuestas. 409 mientras siga abierta.
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AuctionResultOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
auctionRouter.get(
  '/:id/result',
  validate([mongoIdParam()]),
  asyncHandler(auctionController.result),
);

// Pública, también con la subasta abierta: alias de quienes pujaron, sin montos.
/**
 * @openapi
 * /api/auctions/{id}/participants:
 *   get:
 *     tags:
 *     - Auctions
 *     summary: Quiénes pujaron (sin montos)
 *     description: 'Pública, también con la subasta abierta: el secreto es el monto, no la participación
 *       (REGLAS.md §2b).'
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/ParticipantList'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
auctionRouter.get(
  '/:id/participants',
  validate([mongoIdParam()]),
  asyncHandler(bidController.participants),
);

auctionRouter.use('/:id/bids', bidRouter);
