import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { URL_PATTERN, baseSchemaOptions } from '../utils/schemaOptions.js';

export const HOUSE_THEMES = ['darkness', 'comedy', 'terror', 'corporate'] as const;
export type HouseTheme = (typeof HOUSE_THEMES)[number];

/** Código corto de la casa, ej. "DRK". Se guarda en mayúsculas. */
const CODE_PATTERN = /^[A-Z0-9]{3,10}$/;

export interface IHauntHouse {
  _id: Types.ObjectId;
  name: string;
  code: string;
  theme: HouseTheme;
  description?: string;
  coverImageUrl?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hauntHouseSchema = new Schema<IHauntHouse>(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la casa es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre de la casa debe tener al menos 3 caracteres'],
      maxlength: [60, 'El nombre de la casa no puede superar los 60 caracteres'],
    },
    code: {
      type: String,
      required: [true, 'El código de la casa es obligatorio'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [CODE_PATTERN, 'El código debe tener entre 3 y 10 letras o números, sin espacios'],
    },
    theme: {
      type: String,
      required: [true, 'La temática es obligatoria'],
      enum: {
        values: HOUSE_THEMES,
        message: 'La temática debe ser darkness, comedy, terror o corporate',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripción no puede superar los 500 caracteres'],
    },
    coverImageUrl: {
      type: String,
      trim: true,
      match: [URL_PATTERN, 'La imagen de portada debe ser una URL http(s) válida'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La casa debe tener un creador'],
    },
  },
  baseSchemaOptions,
);

export const HauntHouse = model<IHauntHouse>('HauntHouse', hauntHouseSchema);

export type HauntHouseDocument = HydratedDocument<IHauntHouse>;
