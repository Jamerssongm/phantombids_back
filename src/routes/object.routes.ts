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

/**
 * @openapi
 * /api/objects:
 *   get:
 *     tags:
 *     - Objects
 *     summary: Listar objetos
 *     parameters:
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 *     - name: house
 *       in: query
 *       schema:
 *         type: string
 *         pattern: ^[a-f0-9]{24}$
 *     - name: curse
 *       in: query
 *       schema:
 *         type: string
 *         pattern: ^[a-f0-9]{24}$
 *     responses:
 *       200:
 *         $ref: '#/components/responses/CursedObjectPage'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
objectRouter.get(
  '/',
  validate([
    ...paginationQuery,
    query('house').optional().isMongoId().withMessage('"house" no es un identificador válido'),
    query('curse').optional().isMongoId().withMessage('"curse" no es un identificador válido'),
  ]),
  asyncHandler(objectController.list),
);
/**
 * @openapi
 * /api/objects/{id}:
 *   get:
 *     tags:
 *     - Objects
 *     summary: Un objeto con su casa y maldición
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/CursedObjectOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
objectRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(objectController.getById));

// Membresía de la casa, creador y head_haunter: lo verifica el service.
/**
 * @openapi
 * /api/objects:
 *   post:
 *     tags:
 *     - Objects
 *     summary: Publicar un objeto
 *     description: Miembro de la casa o admin. La casa y la maldición deben existir; maxBid > minBid.
 *     security:
 *     - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ObjectInput'
 *     responses:
 *       201:
 *         $ref: '#/components/responses/CursedObjectCreated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
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
/**
 * @openapi
 * /api/objects/{id}:
 *   put:
 *     tags:
 *     - Objects
 *     summary: Editar un objeto
 *     description: Creador, head_haunter de la casa o admin. 409 si el objeto tiene una subasta abierta.
 *       La casa no se puede cambiar.
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
 *               name:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               curse:
 *                 type: string
 *                 pattern: ^[a-f0-9]{24}$
 *               minBid:
 *                 type: integer
 *                 minimum: 1
 *               maxBid:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         $ref: '#/components/responses/CursedObjectOk'
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
/**
 * @openapi
 * /api/objects/{id}:
 *   delete:
 *     tags:
 *     - Objects
 *     summary: Borrar un objeto
 *     description: Creador, head_haunter o admin. 409 si tiene subastas que no estén scheduled.
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
objectRouter.delete(
  '/:id',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(objectController.remove),
);
