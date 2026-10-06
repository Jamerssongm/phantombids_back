import { Router } from 'express';
import { body } from 'express-validator';
import * as curseController from '../controllers/curse.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validate } from '../middlewares/validate.js';
import { CURSE_SEVERITIES } from '../models/Curse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdParam, trimmedString } from '../utils/validators.js';

export const curseRouter = Router();

/** Mismas reglas en create y update; en update todos los campos son opcionales. */
function curseBody(optional: boolean) {
  const opt = <T extends { optional: () => T }>(chain: T) => (optional ? chain.optional() : chain);
  return [
    trimmedString('name', { min: 3, max: 60, optional }),
    trimmedString('description', { min: 3, max: 300, optional }),
    opt(body('icon'))
      .isString()
      .trim()
      .matches(/^Gi[A-Z][A-Za-z0-9]*$/)
      .withMessage('"icon" debe ser un nombre de react-icons/gi, ej. "GiFog"'),
    opt(body('durationHours'))
      .isInt({ min: 12, max: 72 })
      .withMessage('"durationHours" debe ser un entero entre 12 y 72')
      .toInt(),
    opt(body('severity'))
      .isIn(CURSE_SEVERITIES)
      .withMessage(`"severity" debe ser uno de: ${CURSE_SEVERITIES.join(', ')}`),
  ];
}

/**
 * @openapi
 * /api/curses:
 *   get:
 *     tags:
 *     - Curses
 *     summary: Catálogo completo de maldiciones
 *     responses:
 *       200:
 *         $ref: '#/components/responses/CurseList'
 */
curseRouter.get('/', asyncHandler(curseController.list));
/**
 * @openapi
 * /api/curses/{id}:
 *   get:
 *     tags:
 *     - Curses
 *     summary: Una maldición
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/CurseOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
curseRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(curseController.getById));

/**
 * @openapi
 * /api/curses:
 *   post:
 *     tags:
 *     - Curses
 *     summary: Crear una maldición (admin)
 *     description: 'Rol requerido: **admin**. La duración debe respetar la escala de su severidad.'
 *     security:
 *     - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurseInput'
 *     responses:
 *       201:
 *         $ref: '#/components/responses/CurseCreated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
curseRouter.post(
  '/',
  autenticar,
  autorizar('admin'),
  validate(curseBody(false)),
  asyncHandler(curseController.create),
);
/**
 * @openapi
 * /api/curses/{id}:
 *   put:
 *     tags:
 *     - Curses
 *     summary: Editar una maldición (admin)
 *     description: 'Rol requerido: **admin**. Todos los campos son opcionales; la escala severidad/duración
 *       se valida sobre el estado final.'
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurseInput'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/CurseOk'
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
curseRouter.put(
  '/:id',
  autenticar,
  autorizar('admin'),
  validate([mongoIdParam(), ...curseBody(true)]),
  asyncHandler(curseController.update),
);
/**
 * @openapi
 * /api/curses/{id}:
 *   delete:
 *     tags:
 *     - Curses
 *     summary: Borrar una maldición (admin)
 *     description: 'Rol requerido: **admin**. 409 si algún objeto o maldición asignada la referencia.'
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
curseRouter.delete(
  '/:id',
  autenticar,
  autorizar('admin'),
  validate([mongoIdParam()]),
  asyncHandler(curseController.remove),
);
