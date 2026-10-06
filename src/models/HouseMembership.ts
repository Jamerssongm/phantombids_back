import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions } from '../utils/schemaOptions.js';

/**
 * houseRole es un eje DISTINTO de User.role:
 * - User.role ("admin" | "user") es GLOBAL y es el que usa el middleware `autorizar`
 *   (criterio 5 de la rúbrica).
 * - houseRole es POR CASA: un mismo usuario puede ser head_haunter en una casa y
 *   spirit en otra. Los permisos asumidos de cada uno están en docs/REGLAS.md §7.
 */
export const HOUSE_ROLES = ['head_haunter', 'senior_spook', 'spirit', 'poltergeist'] as const;
export type HouseRole = (typeof HOUSE_ROLES)[number];

export interface IHouseMembership {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  house: Types.ObjectId;
  houseRole: HouseRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const houseMembershipSchema = new Schema<IHouseMembership>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La membresía debe indicar el usuario'],
    },
    house: {
      type: Schema.Types.ObjectId,
      ref: 'HauntHouse',
      required: [true, 'La membresía debe indicar la casa'],
    },
    houseRole: {
      type: String,
      enum: {
        values: HOUSE_ROLES,
        message: 'El rol de casa debe ser head_haunter, senior_spook, spirit o poltergeist',
      },
      default: 'spirit',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  baseSchemaOptions,
);

// Un usuario pertenece a una casa como máximo una vez.
houseMembershipSchema.index({ user: 1, house: 1 }, { unique: true });
// Listar miembros de una casa.
houseMembershipSchema.index({ house: 1, houseRole: 1 });

export const HouseMembership = model<IHouseMembership>('HouseMembership', houseMembershipSchema);

export type HouseMembershipDocument = HydratedDocument<IHouseMembership>;
