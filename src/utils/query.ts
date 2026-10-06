/**
 * Lectura tipada de valores del query string. Los validadores de la ruta ya
 * comprobaron el formato; esto solo estrecha el tipo `unknown` de req.query sin
 * castear, y descarta arrays (?role=a&role=b) o valores vacíos.
 */
export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function queryBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

/** Escapa un texto para usarlo literal dentro de un RegExp (búsquedas "contiene"). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Filtro "contiene, sin distinguir mayúsculas" para Mongo. */
export function containsInsensitive(text: string): RegExp {
  return new RegExp(escapeRegex(text), 'i');
}
