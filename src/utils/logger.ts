import { env } from '../config/env.js';

/**
 * Logger de la aplicación: una línea por evento con timestamp ISO y nivel.
 *
 *   2026-10-31T20:00:00.000Z INFO  MongoDB conectado (base: phantombids)
 *
 * - `debug` solo fuera de producción.
 * - Con NODE_ENV=test no escribe nada (los tests no se llenan de ruido).
 * - Un Error en los argumentos se imprime con su stack.
 *
 * Las peticiones HTTP las registra morgan (app.ts), no este logger.
 * Excepciones deliberadas que siguen usando console: utils/seed.ts (es un script
 * de consola y su tabla de resumen es la salida) y config/env.ts (falla antes de
 * que exista configuración, y este logger depende de ella).
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LABEL: Record<Level, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

function write(level: Level, message: string, meta: unknown[]): void {
  if (env.NODE_ENV === 'test') return;
  if (level === 'debug' && env.isProduction) return;

  const line = `${new Date().toISOString()} ${LABEL[level]} ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(line, ...meta.map((m) => (m instanceof Error ? (m.stack ?? m.message) : m)));
}

export const logger = {
  debug: (message: string, ...meta: unknown[]) => write('debug', message, meta),
  info: (message: string, ...meta: unknown[]) => write('info', message, meta),
  warn: (message: string, ...meta: unknown[]) => write('warn', message, meta),
  error: (message: string, ...meta: unknown[]) => write('error', message, meta),
};
