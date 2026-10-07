import type { ErrorRequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError, isAppError, type ErrorDetail } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Mensajes legibles para cada índice único, por "<colección>.<índice>".
 * Al agregar un índice unique a un modelo, sumarlo acá.
 */
const DUPLICATE_KEY_MESSAGES: Record<string, string> = {
  'users.email_1': 'Ya existe una cuenta registrada con ese email',
  'users.alias_1': 'Ese alias ya está en uso',
  'haunthouses.code_1': 'Ya existe una casa con ese código',
  'curses.name_1': 'Ya existe una maldición con ese nombre',
  'housememberships.user_1_house_1': 'El usuario ya es miembro de esta casa',
  'bids.auction_1_user_1': 'Ya pujaste en esta subasta: solo se permite una puja por usuario',
  'sidebets.auction_1_bettor_1':
    'Ya apostaste en esta subasta: solo se permite una apuesta por usuario',
};

function fromDuplicateKey(error: InstanceType<typeof mongoose.mongo.MongoServerError>): AppError {
  // errmsg: "E11000 duplicate key error collection: <db>.<colección> index: <índice> dup key: {...}"
  const match = /collection: [^.]+\.(\S+) index: (\S+)/.exec(error.message);
  const collection = match?.[1] ?? '';
  const index = match?.[2] ?? '';
  const fields = Object.keys((error.keyPattern as Record<string, unknown> | undefined) ?? {});
  const message =
    DUPLICATE_KEY_MESSAGES[`${collection}.${index}`] ??
    `Ya existe un registro con el mismo valor en: ${fields.join(', ') || index}`;
  return AppError.conflict(
    message,
    fields.map((field) => ({ field, message })),
    'DUPLICATE_KEY',
  );
}

function fromValidationError(error: mongoose.Error.ValidationError): AppError {
  const details: ErrorDetail[] = Object.values(error.errors).map((e) => ({
    field: e.path,
    value: e.path.toLowerCase().includes('password') ? '[oculto]' : e.value,
    // Un CastError dentro de una validación (ej. "abc" en un campo Number) trae un
    // mensaje en inglés: se reemplaza por uno legible.
    message:
      e instanceof mongoose.Error.CastError
        ? `El valor de "${e.path}" no tiene el tipo esperado (${e.kind})`
        : e.message,
  }));
  return AppError.unprocessable('Los datos enviados no son válidos', details);
}

function fromCastError(error: mongoose.Error.CastError): AppError {
  const message =
    error.kind === 'ObjectId'
      ? `"${String(error.value)}" no es un identificador válido`
      : `El valor de "${error.path}" no tiene el tipo esperado (${error.kind})`;
  return AppError.badRequest(
    message,
    [{ field: error.path, value: error.value, message }],
    'INVALID_ID',
  );
}

function hasType(error: unknown, type: string): boolean {
  return typeof error === 'object' && error !== null && (error as { type?: unknown }).type === type;
}

/** Traduce cualquier error conocido a un AppError. Lo desconocido devuelve null (→ 500). */
function normalize(error: unknown): AppError | null {
  if (isAppError(error)) return error;
  if (error instanceof mongoose.Error.ValidationError) return fromValidationError(error);
  if (error instanceof mongoose.Error.CastError) return fromCastError(error);
  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    return fromDuplicateKey(error);
  }
  // TokenExpiredError extiende JsonWebTokenError: va primero.
  if (error instanceof jwt.TokenExpiredError) {
    return AppError.unauthorized('La sesión expiró, volvé a iniciar sesión', 'TOKEN_EXPIRED');
  }
  if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
    return AppError.unauthorized('Token inválido', 'INVALID_TOKEN');
  }
  // Errores de body-parser (express.json / express.urlencoded).
  if (error instanceof SyntaxError && hasType(error, 'entity.parse.failed')) {
    return AppError.badRequest('El cuerpo de la petición no es un JSON válido', [], 'INVALID_JSON');
  }
  if (hasType(error, 'entity.too.large')) {
    return new AppError(413, 'El cuerpo de la petición es demasiado grande', 'PAYLOAD_TOO_LARGE');
  }
  return null;
}

/**
 * Middleware global de errores. Va ÚLTIMO en app.ts, después del 404.
 * Todo error de la app termina acá y sale con el formato
 * { success: false, error: { message, code, details } }.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = normalize(error);
  const where = `${req.method} ${req.originalUrl}`;

  if (appError) {
    // Esperado: una línea alcanza, sin stack.
    logger.warn(`[${appError.statusCode}] ${where} ${appError.code}: ${appError.message}`);
    res.status(appError.statusCode).json({
      success: false,
      error: { message: appError.message, code: appError.code, details: appError.details },
    });
    return;
  }

  // Bug o error no contemplado: log completo en el servidor, y al cliente solo lo
  // que corresponde. En producción nunca se filtran mensaje interno ni stack.
  logger.error(`[500] ${where}`, error);
  const err = error instanceof Error ? error : new Error(String(error));
  res.status(500).json({
    success: false,
    error: {
      message: env.isProduction ? 'Error interno del servidor' : err.message,
      code: 'INTERNAL_ERROR',
      details: env.isProduction ? [] : [{ message: err.message, stack: err.stack }],
    },
  });
};
