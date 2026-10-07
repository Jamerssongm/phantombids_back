import { Router } from 'express';
import { body, query } from 'express-validator';
import * as userController from '../controllers/user.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validate } from '../middlewares/validate.js';
import { USER_ROLES } from '../models/User.js';
import { USER_CURSE_STATUSES } from '../models/UserCurse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mongoIdParam, paginationQuery, trimmedString } from '../utils/validators.js';

export const userRouter = Router();

// Todas las rutas de usuarios requieren sesión.
userRouter.use(autenticar);

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *     - Users
 *     summary: Listar usuarios (admin)
 *     description: 'Rol requerido: **admin**. Paginado.'
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Page'
 *     - $ref: '#/components/parameters/Limit'
 *     - name: role
 *       in: query
 *       schema:
 *         type: string
 *         enum:
 *         - admin
 *         - user
 *     - name: alias
 *       in: query
 *       schema:
 *         type: string
 *       description: Contiene, sin distinguir mayúsculas
 *     - name: isActive
 *       in: query
 *       schema:
 *         type: boolean
 *     responses:
 *       200:
 *         $ref: '#/components/responses/UserPage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
userRouter.get(
  '/',
  autorizar('admin'),
  validate([
    ...paginationQuery,
    query('role')
      .optional()
      .isIn(USER_ROLES)
      .withMessage(`"role" debe ser uno de: ${USER_ROLES.join(', ')}`),
    query('alias').optional().isString().trim().isLength({ max: 30 }),
    query('isActive').optional().isBoolean().withMessage('"isActive" debe ser true o false'),
  ]),
  asyncHandler(userController.list),
);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags:
 *     - Users
 *     summary: Perfil de un usuario
 *     description: El **email** solo se incluye si quien consulta es el dueño o un admin.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     responses:
 *       200:
 *         $ref: '#/components/responses/UserOk'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
userRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(userController.getById));

// Dueño o admin (lo verifica el service).
/**
 * @openapi
 * /api/users/{id}/curses:
 *   get:
 *     tags:
 *     - Users
 *     summary: Curse Log de un usuario
 *     description: Dueño o admin. Activas primero. Estado y tiempo restante calculados al vuelo.
 *     security:
 *     - bearerAuth: []
 *     parameters:
 *     - $ref: '#/components/parameters/Id'
 *     - name: status
 *       in: query
 *       schema:
 *         type: string
 *         enum:
 *         - active
 *         - served
 *         - expired
 *     responses:
 *       200:
 *         $ref: '#/components/responses/UserCurseEntryList'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
userRouter.get(
  '/:id/curses',
  validate([
    mongoIdParam(),
    query('status')
      .optional()
      .isIn(USER_CURSE_STATUSES)
      .withMessage(`"status" debe ser uno de: ${USER_CURSE_STATUSES.join(', ')}`),
  ]),
  asyncHandler(userController.curses),
);

// Dueño o admin: lo resuelve el service (la propiedad no es un rol global).
/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags:
 *     - Users
 *     summary: Editar un usuario
 *     description: Dueño o admin. El dueño cambia displayName y avatarUrl; **role** e **isActive** solo
 *       los aplica un admin (si los manda otro, se ignoran). reputation no se edita por API. Un admin no
 *       puede quitarse su propio rol ni darse de baja (409).
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
 *               displayName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               role:
 *                 type: string
 *                 enum:
 *                 - admin
 *                 - user
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         $ref: '#/components/responses/UserOk'
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
userRouter.put(
  '/:id',
  validate([
    mongoIdParam(),
    trimmedString('displayName', { min: 3, max: 50, optional: true }),
    body('avatarUrl')
      .optional({ values: 'null' })
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('El avatar debe ser una URL http(s) válida'),
    body('role')
      .optional()
      .isIn(USER_ROLES)
      .withMessage(`"role" debe ser uno de: ${USER_ROLES.join(', ')}`),
    body('isActive')
      .optional()
      .isBoolean({ strict: true })
      .withMessage('"isActive" debe ser booleano'),
  ]),
  asyncHandler(userController.update),
);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags:
 *     - Users
 *     summary: Dar de baja a un usuario (admin)
 *     description: 'Rol requerido: **admin**. Baja LÓGICA (isActive: false): no puede iniciar sesión y su
 *       token deja de servir. 409 si el admin intenta darse de baja a sí mismo.'
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
userRouter.delete(
  '/:id',
  autorizar('admin'),
  validate([mongoIdParam()]),
  asyncHandler(userController.remove),
);
