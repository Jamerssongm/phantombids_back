import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { URL_PATTERN, baseSchemaOptions } from '../utils/schemaOptions.js';

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Alias anónimo `[Adjetivo]_[Número]`, ej. "Sombrio_042" (mismo formato que el frontend). */
export const ALIAS_PATTERN = /^[A-Z][a-z]+_\d{3}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  alias: string;
  role: UserRole;
  reputation: number;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, 'El email no tiene un formato válido'],
    },
    // select: false — nunca sale en una consulta salvo que se pida con .select('+passwordHash').
    // Además toJSON lo elimina (utils/schemaOptions.ts) por si acaso.
    passwordHash: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      select: false,
    },
    displayName: {
      type: String,
      required: [true, 'El nombre visible es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre visible debe tener al menos 3 caracteres'],
      maxlength: [50, 'El nombre visible no puede superar los 50 caracteres'],
    },
    alias: {
      type: String,
      required: [true, 'El alias es obligatorio'],
      unique: true,
      trim: true,
      match: [ALIAS_PATTERN, 'El alias debe tener el formato Adjetivo_123 (ej. Sombrio_042)'],
    },
    // Rol GLOBAL, el que consume el middleware `autorizar`. No confundir con
    // HouseMembership.houseRole, que es por casa.
    role: {
      type: String,
      enum: { values: USER_ROLES, message: 'El rol debe ser "admin" o "user"' },
      default: 'user',
    },
    reputation: {
      type: Number,
      default: 100,
      min: [0, 'La reputación no puede ser negativa'],
    },
    avatarUrl: {
      type: String,
      trim: true,
      match: [URL_PATTERN, 'El avatar debe ser una URL http(s) válida'],
    },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

export const User = model<IUser>('User', userSchema);

/** Documento de usuario cargado desde la base (el que queda en req.user). */
export type UserDocument = HydratedDocument<IUser>;
