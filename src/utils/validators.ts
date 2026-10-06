import { body, param, query, type ValidationChain } from 'express-validator';
import { MAX_LIMIT } from './pagination.js';

/** Parámetro de ruta que debe ser un ObjectId: validate([mongoIdParam()]) → 400 si no lo es. */
export function mongoIdParam(name = 'id'): ValidationChain {
  return param(name).isMongoId().withMessage(`"${name}" no es un identificador válido`);
}

/** Campo del body que debe ser un ObjectId (referencias: house, curse, auction…). */
export function mongoIdBody(field: string, { optional = false } = {}): ValidationChain {
  const chain = body(field);
  return (optional ? chain.optional() : chain.exists().withMessage(`"${field}" es obligatorio`))
    .bail()
    .isMongoId()
    .withMessage(`"${field}" no es un identificador válido`);
}

/**
 * page y limit opcionales, enteros positivos. Los valores pasan a número.
 * Un limit mayor a MAX_LIMIT no es un error: getPagination() lo recorta.
 */
export const paginationQuery: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('"page" debe ser un entero mayor o igual a 1')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage(`"limit" debe ser un entero entre 1 y ${MAX_LIMIT}`)
    .toInt(),
];

interface StringOptions {
  min?: number;
  max?: number;
  optional?: boolean;
  /**
   * Escapa < > & ' " / como entidades HTML. Solo para texto libre que el frontend
   * podría renderizar como HTML (descripciones, motivos). NO usar en emails,
   * URLs, alias ni contraseñas: los corrompe.
   */
  escape?: boolean;
}

/** String del body con trim, largo validado y escape opcional. */
export function trimmedString(
  field: string,
  { min, max, optional = false, escape = false }: StringOptions = {},
): ValidationChain {
  let chain = body(field);
  chain = optional
    ? chain.optional()
    : chain.exists({ values: 'falsy' }).withMessage(`"${field}" es obligatorio`).bail();
  chain = chain.isString().withMessage(`"${field}" debe ser texto`).bail().trim();
  if (min !== undefined || max !== undefined) {
    const range =
      min !== undefined && max !== undefined
        ? `entre ${min} y ${max} caracteres`
        : min !== undefined
          ? `al menos ${min} caracteres`
          : `como máximo ${max} caracteres`;
    chain = chain.isLength({ min, max }).withMessage(`"${field}" debe tener ${range}`);
  }
  return escape ? chain.escape() : chain;
}

/** URL http(s) opcional del body; null significa "borrar el valor". */
export function optionalUrl(field: string): ValidationChain {
  return body(field)
    .optional({ values: 'null' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`"${field}" debe ser una URL http(s) válida`);
}
