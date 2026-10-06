import mongoose from 'mongoose';
import { User, type UserDocument } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { generateUniqueAlias } from '../utils/alias.js';
import { signToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  avatarUrl?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Únicos campos del perfil que el propio usuario puede cambiar. null borra el avatar. */
export interface UpdateMeInput {
  displayName?: string;
  avatarUrl?: string | null;
}

export interface AuthResult {
  user: UserDocument;
  token: string;
}

const INVALID_CREDENTIALS = 'Credenciales inválidas';
const ALIAS_RACE_RETRIES = 3;

function tokenFor(user: UserDocument): string {
  return signToken({ sub: user.id as string, role: user.role });
}

function isDuplicateOn(error: unknown, field: string): boolean {
  return (
    error instanceof mongoose.mongo.MongoServerError &&
    error.code === 11000 &&
    field in ((error.keyPattern as Record<string, unknown> | undefined) ?? {})
  );
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (await User.exists({ email })) {
    throw AppError.conflict('Ya existe una cuenta registrada con ese email', [], 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(input.password);

  // generateUniqueAlias ya verifica contra la base, pero dos registros simultáneos
  // podrían sacar el mismo alias entre el chequeo y el insert: ante ese choque
  // (E11000 sobre alias) se genera otro.
  for (let attempt = 1; ; attempt++) {
    try {
      const user = await User.create({
        email,
        passwordHash,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        alias: await generateUniqueAlias(),
        // EL ROL NUNCA VIENE DEL REQUEST. Aceptarlo sería una escalada de
        // privilegios de una línea: { "role": "admin" } en el registro.
        role: 'user',
      });
      return { user, token: tokenFor(user) };
    } catch (error) {
      if (isDuplicateOn(error, 'alias') && attempt < ALIAS_RACE_RETRIES) continue;
      throw error; // email duplicado por carrera → errorHandler → 409
    }
  }
}

// Hash de relleno para comparar cuando el email no existe: así el login tarda lo
// mismo en ambos casos y el tiempo de respuesta tampoco revela qué emails existen.
let dummyHash: Promise<string> | undefined;

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');

  dummyHash ??= hashPassword('contraseña-de-relleno-para-igualar-tiempos');
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash));

  // MISMO mensaje para email inexistente y contraseña incorrecta: mensajes
  // distintos permitirían enumerar qué emails están registrados.
  if (!user || !valid) {
    throw AppError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }
  // Solo se informa la baja a quien ya demostró conocer la contraseña.
  if (!user.isActive) {
    throw AppError.unauthorized('La cuenta está desactivada', 'ACCOUNT_DISABLED');
  }

  return { user, token: tokenFor(user) };
}

/** Perfil del usuario autenticado. `autenticar` ya lo cargó desde la base en este request. */
export function getMe(user: UserDocument): UserDocument {
  return user;
}

/**
 * Lista blanca explícita: solo displayName y avatarUrl. Se usa save() (no
 * findOneAndUpdate) para que corran las validaciones del schema.
 */
export async function updateMe(user: UserDocument, input: UpdateMeInput): Promise<UserDocument> {
  if (input.displayName !== undefined) user.displayName = input.displayName;
  if (input.avatarUrl === null) user.set('avatarUrl', undefined);
  else if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
  await user.save();
  return user;
}
