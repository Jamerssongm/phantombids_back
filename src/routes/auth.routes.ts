import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { autorizar } from '../middlewares/autorizar.js';
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

authRouter.get('/me', autenticar, asyncHandler(authController.getMe));

authRouter.put(
  '/me',
  autenticar,
  validate([trimmedString('displayName', { min: 3, max: 50, optional: true }), avatarUrl()]),
  asyncHandler(authController.updateMe),
);

// TODO(b06): BORRAR. Ruta temporal para demostrar el criterio 5 (autorizar) antes
// de que existan rutas de negocio protegidas por rol.
authRouter.get(
  '/admin-check',
  autenticar,
  autorizar('admin'),
  asyncHandler(authController.adminCheck),
);
