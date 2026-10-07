import { Router } from 'express';
import { body } from 'express-validator';
import * as membershipController from '../controllers/membership.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { HOUSE_ROLES } from '../models/HouseMembership.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdBody, mongoIdParam } from '../utils/validators.js';

/** Montado en /api/houses/:id/members (mergeParams para leer :id de la casa). */
export const membershipRouter = Router({ mergeParams: true });

const roleMessage = `"houseRole" debe ser uno de: ${HOUSE_ROLES.join(', ')}`;

/**
 * @openapi
 * /api/houses/{id}/members:
 *   get:
 *     tags:
 *     - Members
 *     summary: Miembros de una casa
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/HouseMembershipList'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
membershipRouter.get('/', validate([mongoIdParam()]), asyncHandler(membershipController.list));

// Permisos (head_haunter o admin; salirse uno mismo) los resuelve el service.
/**
 * @openapi
 * /api/houses/{id}/members:
 *   post:
 *     tags:
 *     - Members
 *     summary: Agregar un miembro
 *     description: 'head_haunter de la casa o admin. Rol por defecto: spirit. 409 si ya es miembro o está
 *       dado de baja.'
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
 *               userId:
 *                 type: string
 *                 pattern: ^[a-f0-9]{24}$
 *               houseRole:
 *                 type: string
 *                 enum:
 *                 - head_haunter
 *                 - senior_spook
 *                 - spirit
 *                 - poltergeist
 *             required:
 *             - userId
 *     responses:
 *       201:
 *         $ref: '#/components/responses/HouseMembershipCreated'
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
membershipRouter.post(
  '/',
  autenticar,
  validate([
    mongoIdParam(),
    mongoIdBody('userId'),
    body('houseRole').optional().isIn(HOUSE_ROLES).withMessage(roleMessage),
  ]),
  asyncHandler(membershipController.add),
);
/**
 * @openapi
 * /api/houses/{id}/members/{userId}:
 *   put:
 *     tags:
 *     - Members
 *     summary: Cambiar el rol de casa de un miembro
 *     description: head_haunter de la casa o admin. 409 si se degrada al último head_haunter.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     - $ref: '#/components/parameters/UserIdPath'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               houseRole:
 *                 type: string
 *                 enum:
 *                 - head_haunter
 *                 - senior_spook
 *                 - spirit
 *                 - poltergeist
 *             required:
 *             - houseRole
 *     responses:
 *       200:
 *         $ref: '#/components/responses/HouseMembershipOk'
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
membershipRouter.put(
  '/:userId',
  autenticar,
  validate([
    mongoIdParam(),
    mongoIdParam('userId'),
    body('houseRole')
      .exists()
      .withMessage('"houseRole" es obligatorio')
      .bail()
      .isIn(HOUSE_ROLES)
      .withMessage(roleMessage),
  ]),
  asyncHandler(membershipController.updateRole),
);
/**
 * @openapi
 * /api/houses/{id}/members/{userId}:
 *   delete:
 *     tags:
 *     - Members
 *     summary: Expulsar a un miembro o salirse
 *     description: head_haunter o admin expulsan; cualquier miembro puede salirse solo. 409 si es el último
 *       head_haunter.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     - $ref: '#/components/parameters/UserIdPath'
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
membershipRouter.delete(
  '/:userId',
  autenticar,
  validate([mongoIdParam(), mongoIdParam('userId')]),
  asyncHandler(membershipController.remove),
);
