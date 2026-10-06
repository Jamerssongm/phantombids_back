import { Router } from 'express';
import { body, query } from 'express-validator';
import * as houseController from '../controllers/house.controller.js';
import { autenticar } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { HOUSE_THEMES } from '../models/HauntHouse.js';
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
houseRouter.get('/:id', validate([mongoIdParam()]), asyncHandler(houseController.getById));

// Cualquier usuario autenticado puede crear una casa; queda como head_haunter.
houseRouter.post('/', autenticar, validate(houseBody(false)), asyncHandler(houseController.create));

// head_haunter de la casa o admin: lo verifica el service (rol de casa, no global).
houseRouter.put(
  '/:id',
  autenticar,
  validate([mongoIdParam(), ...houseBody(true)]),
  asyncHandler(houseController.update),
);
houseRouter.delete(
  '/:id',
  autenticar,
  validate([mongoIdParam()]),
  asyncHandler(houseController.remove),
);
