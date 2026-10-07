import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { trimmedString } from '../utils/validators.js';

export const authRouter = Router();

const email = () =>
  body('email')
    .exists({ values: 'falsy' })
    .withMessage('El email es obligatorio')
    .bail()
    .isString()
    .trim()
    .isEmail()
    .withMessage('El email no tiene un formato válido')
    .toLowerCase();

// bcrypt solo usa los primeros 72 bytes: más largo daría una falsa sensación de seguridad.
const newPassword = () =>
  body('password')
    .exists({ values: 'falsy' })
    .withMessage('La contraseña es obligatoria')
    .bail()
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('La contraseña debe tener entre 8 y 72 caracteres');

const avatarUrl = () =>
  body('avatarUrl')
    .optional({ values: 'null' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('El avatar debe ser una URL http(s) válida');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *     - Auth
 *     summary: Registrar un usuario
 *     description: 'Crea la cuenta con rol **user** (el rol nunca se acepta del body: si llega, se ignora)
 *       y un alias anónimo generado. Devuelve el usuario y un token. Rate limit: 10 registros por IP cada
 *       15 minutos.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: casper@ghost.dev
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *                 example: Boo12345
 *               displayName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: Casper el Amigable
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *             required:
 *             - email
 *             - password
 *             - displayName
 *     responses:
 *       201:
 *         $ref: '#/components/responses/AuthResultOk'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
authRouter.post(
  '/register',
  registerLimiter,
  validate([
    email(),
    newPassword(),
    trimmedString('displayName', { min: 3, max: 50 }),
    avatarUrl(),
  ]),
  asyncHandler(authController.register),
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *     - Auth
 *     summary: Iniciar sesión
 *     description: 'Devuelve el usuario y un JWT. El mismo mensaje ("Credenciales inválidas") para email
 *       inexistente y contraseña incorrecta. Rate limit: 10 intentos FALLIDOS por IP cada 15 minutos.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@phantombids.dev
 *               password:
 *                 type: string
 *                 example: Admin123!
 *             required:
 *             - email
 *             - password
 *     responses:
 *       200:
 *         $ref: '#/components/responses/AuthResultOk'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
authRouter.post(
  '/login',
  loginLimiter,
  validate([
    email(),
    // En el login no se exige la política de longitud: solo que venga.
    body('password')
      .exists({ values: 'falsy' })
      .withMessage('La contraseña es obligatoria')
      .isString(),
  ]),
  asyncHandler(authController.login),
);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *     - Auth
 *     summary: Perfil propio
 *     security:
 *     - bearerAuth: []
 *     responses:
 *       200:
 *         $ref: '#/components/responses/UserOk'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
authRouter.get('/me', autenticar, asyncHandler(authController.getMe));

/**
 * @openapi
 * /api/auth/me:
 *   put:
 *     tags:
 *     - Auth
 *     summary: Editar el perfil propio
 *     description: Solo displayName y avatarUrl (null borra el avatar). Cualquier otro campo se ignora.
 *     security:
 *     - bearerAuth: []
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
 *     responses:
 *       200:
 *         $ref: '#/components/responses/UserOk'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
authRouter.put(
  '/me',
  autenticar,
  validate([trimmedString('displayName', { min: 3, max: 50, optional: true }), avatarUrl()]),
  asyncHandler(authController.updateMe),
);
