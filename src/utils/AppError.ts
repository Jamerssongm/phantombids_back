/** Detalle por campo de un error (validación, clave duplicada, etc.). */
export interface ErrorDetail {
  field?: string;
  location?: string;
  value?: unknown;
  message: string;
}

/**
 * Error operacional: algo esperado que el cliente puede corregir o que el sistema
 * contempla (recurso inexistente, sin permiso, conflicto). `isOperational`
 * distingue estos errores de los bugs, que el errorHandler responde como 500.
 *
 *   throw AppError.notFound('La subasta no existe');
 */
export class AppError extends Error {
  readonly isOperational = true;

  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string = 'ERROR',
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Solicitud inválida', details?: ErrorDetail[], code = 'BAD_REQUEST') {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message = 'No autenticado', code = 'UNAUTHORIZED') {
    return new AppError(401, message, code);
  }

  static forbidden(message = 'No tenés permiso para realizar esta acción', code = 'FORBIDDEN') {
    return new AppError(403, message, code);
  }

  static notFound(message = 'Recurso no encontrado', code = 'NOT_FOUND') {
    return new AppError(404, message, code);
  }

  static conflict(
    message = 'Conflicto con el estado actual del recurso',
    details?: ErrorDetail[],
    code = 'CONFLICT',
  ) {
    return new AppError(409, message, code, details);
  }

  static unprocessable(
    message = 'Los datos enviados no son válidos',
    details?: ErrorDetail[],
    code = 'VALIDATION_ERROR',
  ) {
    return new AppError(422, message, code, details);
  }

  static internal(message = 'Error interno del servidor', code = 'INTERNAL_ERROR') {
    return new AppError(500, message, code);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
