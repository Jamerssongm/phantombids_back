import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions } from '../utils/schemaOptions.js';

/** Estados de una maldición asignada (docs/REGLAS.md §4). */
export const USER_CURSE_STATUSES = ['active', 'served', 'expired'] as const;
export type UserCurseStatus = (typeof USER_CURSE_STATUSES)[number];

/** Maldición asignada a un usuario: es la entrada del Curse Log (/profile/curses). */
export interface IUserCurse {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  curse: Types.ObjectId;
  reason: string;
  sourceAuction?: Types.ObjectId;
  imposedAt: Date;
  expiresAt: Date;
  status: UserCurseStatus;
  createdAt: Date;
  updatedAt: Date;
}

const userCurseSchema = new Schema<IUserCurse>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La maldición asignada debe indicar el usuario'],
    },
    curse: {
      type: Schema.Types.ObjectId,
      ref: 'Curse',
      required: [true, 'La maldición asignada debe indicar qué maldición es'],
    },
    reason: {
      type: String,
      required: [true, 'El motivo de la maldición es obligatorio'],
      trim: true,
      minlength: [3, 'El motivo debe tener al menos 3 caracteres'],
      maxlength: [200, 'El motivo no puede superar los 200 caracteres'],
    },
    sourceAuction: { type: Schema.Types.ObjectId, ref: 'Auction' },
    imposedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: [true, 'La fecha de vencimiento es obligatoria'] },
    status: {
      type: String,
      enum: {
        values: USER_CURSE_STATUSES,
        message: 'El estado debe ser active, served o expired',
      },
      default: 'active',
    },
  },
  baseSchemaOptions,
);

// Validación entre campos. Corre en save()/validate(), NO en findOneAndUpdate.
userCurseSchema.pre('validate', async function () {
  if (this.imposedAt && this.expiresAt && this.expiresAt <= this.imposedAt) {
    this.invalidate(
      'expiresAt',
      'La fecha de vencimiento debe ser posterior a la de imposición',
      this.expiresAt,
    );
  }
});

// Curse Log de un usuario y vencimiento de maldiciones activas.
userCurseSchema.index({ user: 1, status: 1 });
userCurseSchema.index({ status: 1, expiresAt: 1 });

export const UserCurse = model<IUserCurse>('UserCurse', userCurseSchema);

export type UserCurseDocument = HydratedDocument<IUserCurse>;
