import type { SchemaOptions } from 'mongoose';

/**
 * Forma pública de cualquier documento: `_id` pasa a `id` (string, como espera el
 * frontend), y se eliminan `__v` y `passwordHash`. Se aplica también a los
 * documentos populados, porque cada uno usa el toJSON de su propio schema.
 */
function toPublicJSON(_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> {
  const { _id, __v, passwordHash, ...rest } = ret;
  void __v;
  void passwordHash;
  return { id: String(_id), ...rest };
}

/** Opciones comunes a todos los schemas: timestamps y la transformación de toJSON. */
export const baseSchemaOptions = {
  timestamps: true,
  toJSON: { transform: toPublicJSON },
} satisfies SchemaOptions;

/** URL http(s) sin espacios. Validación de forma, no de que el recurso exista. */
export const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

/** Validador reutilizable para campos numéricos que deben ser enteros. */
export function integerValidator(label: string) {
  return {
    validator: (value: number | null | undefined) => value == null || Number.isInteger(value),
    message: `${label} debe ser un número entero`,
  };
}
