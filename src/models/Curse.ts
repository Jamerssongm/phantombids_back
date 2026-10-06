import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions, integerValidator } from '../utils/schemaOptions.js';

/**
 * Catálogo de las 8 maldiciones predefinidas. Son datos de catálogo administrados
 * por `admin`, no datos de usuario: la maldición asignada a alguien es UserCurse.
 * El efecto de cada maldición no está definido (docs/REGLAS.md §4): solo se registra.
 */
export const CURSE_SEVERITIES = ['minor', 'moderate', 'severe'] as const;
export type CurseSeverity = (typeof CURSE_SEVERITIES)[number];

/** Nombre de componente de react-icons/gi, ej. "GiFog". */
const ICON_PATTERN = /^Gi[A-Z][A-Za-z0-9]*$/;

export interface ICurse {
  _id: Types.ObjectId;
  name: string;
  description: string;
  icon: string;
  durationHours: number;
  severity: CurseSeverity;
  createdAt: Date;
  updatedAt: Date;
}

const curseSchema = new Schema<ICurse>(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la maldición es obligatorio'],
      unique: true,
      trim: true,
      minlength: [3, 'El nombre de la maldición debe tener al menos 3 caracteres'],
      maxlength: [60, 'El nombre de la maldición no puede superar los 60 caracteres'],
    },
    description: {
      type: String,
      required: [true, 'La descripción de la maldición es obligatoria'],
      trim: true,
      maxlength: [300, 'La descripción no puede superar los 300 caracteres'],
    },
    icon: {
      type: String,
      required: [true, 'El ícono de la maldición es obligatorio'],
      trim: true,
      match: [ICON_PATTERN, 'El ícono debe ser un nombre de react-icons/gi, ej. "GiFog"'],
    },
    durationHours: {
      type: Number,
      required: [true, 'La duración de la maldición es obligatoria'],
      min: [12, 'La duración mínima de una maldición es de 12 horas'],
      max: [72, 'La duración máxima de una maldición es de 72 horas'],
      validate: integerValidator('La duración en horas'),
    },
    severity: {
      type: String,
      required: [true, 'La severidad de la maldición es obligatoria'],
      enum: { values: CURSE_SEVERITIES, message: 'La severidad debe ser minor, moderate o severe' },
    },
  },
  baseSchemaOptions,
);

export const Curse = model<ICurse>('Curse', curseSchema);

export type CurseDocument = HydratedDocument<ICurse>;
