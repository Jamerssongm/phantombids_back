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

curseRouter.get('/', asyncHandler(curseController.list));
curseRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(curseController.getById));

curseRouter.post(
  '/',
  autenticar,
  autorizar('admin'),
  validate(curseBody(false)),
  asyncHandler(curseController.create),
);
curseRouter.put(
  '/:id',
  autenticar,
  autorizar('admin'),
  validate([mongoIdParam(), ...curseBody(true)]),
  asyncHandler(curseController.update),
);
curseRouter.delete(
  '/:id',
  autenticar,
  autorizar('admin'),
  validate([mongoIdParam()]),
  asyncHandler(curseController.remove),
);
