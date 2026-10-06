import { Router } from 'express';
import { body, query } from 'express-validator';
import * as houseController from '../controllers/house.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { HOUSE_THEMES } from '../models/HauntHouse.js';
import { membershipRouter } from './membership.routes.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdParam, optionalUrl, paginationQuery, trimmedString } from '../utils/validators.js';

export const houseRouter = Router();

const themeMessage = `"theme" debe ser uno de: ${HOUSE_THEMES.join(', ')}`;

function houseBody(optional: boolean) {
  const code = body('code');
  const theme = body('theme');
  return [
    trimmedString('name', { min: 3, max: 60, optional }),
    (optional
      ? code.optional()
      : code.exists({ values: 'falsy' }).withMessage('"code" es obligatorio')
    )
      .isString()
      .trim()
      .matches(/^[A-Za-z0-9]{3,10}$/)
      .withMessage('"code" debe tener entre 3 y 10 letras o números, sin espacios')
      .toUpperCase(),
    (optional ? theme.optional() : theme.exists().withMessage('"theme" es obligatorio'))
      .isIn(HOUSE_THEMES)
      .withMessage(themeMessage),
    body('description')
      .optional({ values: 'null' })
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('"description" puede tener como máximo 500 caracteres'),
    optionalUrl('coverImageUrl'),
  ];
}

/**
 * @openapi
 * /api/houses:
 *   get:
 *     tags:
 *     - Houses
 *     summary: Listar casas
 *     parameters:
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 *     - name: theme
 *       in: query
 *       schema:
 *         type: string
 *         enum:
 *         - darkness
 *         - comedy
 *         - terror
 *         - corporate
 *     - name: name
 *       in: query
 *       schema:
 *         type: string
 *       description: Contiene
 *     - name: code
 *       in: query
 *       schema:
 *         type: string
 *       description: Contiene
 *     responses:
 *       200:
 *         $ref: '#/components/responses/HauntHousePage'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
houseRouter.get(
  '/',
  validate([
    ...paginationQuery,
    query('theme').optional().isIn(HOUSE_THEMES).withMessage(themeMessage),
    query('name').optional().isString().trim().isLength({ max: 60 }),
    query('code').optional().isString().trim().isLength({ max: 10 }),
  ]),
  asyncHandler(houseController.list),
);
/**
 * @openapi
 * /api/houses/{id}:
 *   get:
 *     tags:
 *     - Houses
 *     summary: Detalle de una casa con miembros y objetos
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/HouseDetailOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
houseRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(houseController.getById));

// Cualquier usuario autenticado puede crear una casa; queda como head_haunter.
/**
 * @openapi
 * /api/houses:
 *   post:
 *     tags:
 *     - Houses
 *     summary: Crear una casa
 *     description: Cualquier usuario autenticado. Quien la crea queda como su **head_haunter**.
 *     security:
 *     - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HouseInput'
 *     responses:
 *       201:
 *         $ref: '#/components/responses/HauntHouseCreated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
houseRouter.post('/', autenticar, validate(houseBody(false)), asyncHandler(houseController.create));

// head_haunter de la casa o admin: lo verifica el service (rol de casa, no global).
/**
 * @openapi
 * /api/houses/{id}:
 *   put:
 *     tags:
 *     - Houses
 *     summary: Editar una casa
 *     description: head_haunter de la casa o admin.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HouseInput'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/HauntHouseOk'
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
houseRouter.put(
  '/:id',
  autenticar,
  validate([mongoIdParam(), ...houseBody(true)]),
  asyncHandler(houseController.update),
);
/**
 * @openapi
 * /api/houses/{id}:
 *   delete:
 *     tags:
 *     - Houses
 *     summary: Borrar una casa
 *     description: head_haunter de la casa o admin. 409 si tiene subastas abiertas o con historia (REGLAS.md
 *       §7b).
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
houseRouter.delete(
  '/:id',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(houseController.remove),
);

houseRouter.use('/:id/members', membershipRouter);
