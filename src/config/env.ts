import { config } from 'dotenv';

// Carga .env en desarrollo. En Render las variables vienen del dashboard y dotenv
// no las pisa (override: false por defecto).
config({ quiet: true });

const NODE_ENVS = ['development', 'production', 'test'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  readonly PORT: number;
  readonly NODE_ENV: NodeEnv;
  readonly MONGODB_URI: string;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: string;
  readonly BCRYPT_ROUNDS: number;
  readonly CORS_ORIGIN: readonly string[];
  readonly AUTO_CLOSE_ENABLED: boolean;
  readonly isProduction: boolean;
}

const errors: string[] = [];

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === '' ? undefined : value;
}

function required(name: string): string {
  const value = read(name);
  if (value === undefined) {
    errors.push(`${name} es obligatoria y no está definida`);
    return '';
  }
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} debe ser un entero entre ${min} y ${max} (recibido: "${raw}")`);
    return fallback;
  }
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = read(name);
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  errors.push(`${name} debe ser "true" o "false" (recibido: "${raw}")`);
  return fallback;
}

function nodeEnv(): NodeEnv {
  const raw = read('NODE_ENV') ?? 'development';
  if ((NODE_ENVS as readonly string[]).includes(raw)) return raw as NodeEnv;
  errors.push(`NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')} (recibido: "${raw}")`);
  return 'development';
}

function mongoUri(): string {
  const value = required('MONGODB_URI');
  if (value && !/^mongodb(\+srv)?:\/\//.test(value)) {
    // No se imprime el valor: si es una cadena real mal pegada, lleva la contraseña.
    errors.push('MONGODB_URI debe empezar con "mongodb://" o "mongodb+srv://"');
  }
  return value;
}

function jwtSecret(): string {
  const value = required('JWT_SECRET');
  if (value && value.length < 32) {
    errors.push(`JWT_SECRET debe tener al menos 32 caracteres (tiene ${value.length})`);
  }
  return value;
}

function jwtExpiresIn(): string {
  const value = read('JWT_EXPIRES_IN') ?? '1d';
  // Formato aceptado por jsonwebtoken: segundos ("3600") o número + unidad ("15m", "1d").
  if (!/^\d+(ms|s|m|h|d|w|y)?$/.test(value)) {
    errors.push(
      `JWT_EXPIRES_IN debe ser segundos o número + unidad, ej. "1d" (recibido: "${value}")`,
    );
  }
  return value;
}

function corsOrigin(): string[] {
  const raw = read('CORS_ORIGIN') ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const NODE_ENV = nodeEnv();

const parsed: Env = {
  PORT: integer('PORT', 3000, 1, 65535),
  NODE_ENV,
  MONGODB_URI: mongoUri(),
  JWT_SECRET: jwtSecret(),
  JWT_EXPIRES_IN: jwtExpiresIn(),
  BCRYPT_ROUNDS: integer('BCRYPT_ROUNDS', 10, 4, 15),
  CORS_ORIGIN: Object.freeze(corsOrigin()),
  AUTO_CLOSE_ENABLED: boolean('AUTO_CLOSE_ENABLED', true),
  isProduction: NODE_ENV === 'production',
};

if (errors.length > 0) {
  console.error('❌ Configuración inválida. Revisá las variables de entorno (ver .env.example):');
  for (const error of errors) console.error(`   - ${error}`);
  process.exit(1);
}

export const env: Env = Object.freeze(parsed);
