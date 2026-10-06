import { Schema, model, type Types } from 'mongoose';
import { baseSchemaOptions } from '../utils/schemaOptions.js';

/** Fichas permitidas (docs/ESPEC.md y docs/REGLAS.md §5). */
export const SIDE_BET_CHIPS = [5, 10, 25, 50] as const;
export type SideBetChips = (typeof SIDE_BET_CHIPS)[number];

export const SIDE_BET_RESULTS = ['pending', 'won', 'lost'] as const;
export type SideBetResult = (typeof SIDE_BET_RESULTS)[number];

/**
 * Apuesta paralela sobre quién gana una subasta. Saldo suficiente, subasta abierta
 * y que targetUser sea participante son reglas de NEGOCIO: van en services/.
 */
export interface ISideBet {
  _id: Types.ObjectId;
  auction: Types.ObjectId;
  bettor: Types.ObjectId;
  targetUser: Types.ObjectId;
  chips: SideBetChips;
  result: SideBetResult;
  payout: number;
  createdAt: Date;
  updatedAt: Date;
}

const sideBetSchema = new Schema<ISideBet>(
  {
    auction: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'La apuesta debe indicar la subasta'],
    },
    bettor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La apuesta debe indicar quién apuesta'],
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La apuesta debe indicar por quién se apuesta'],
    },
    chips: {
      type: Number,
      required: [true, 'La cantidad de fichas es obligatoria'],
      enum: { values: SIDE_BET_CHIPS, message: 'Las fichas deben ser 5, 10, 25 o 50' },
    },
    result: {
      type: String,
      enum: { values: SIDE_BET_RESULTS, message: 'El resultado debe ser pending, won o lost' },
      default: 'pending',
    },
    payout: {
      type: Number,
      default: 0,
      min: [0, 'El pago de la apuesta no puede ser negativo'],
    },
  },
  baseSchemaOptions,
);

// No se apuesta por uno mismo. Corre en save()/validate(), NO en findOneAndUpdate.
sideBetSchema.pre('validate', async function () {
  if (this.bettor && this.targetUser && this.bettor.equals(this.targetUser)) {
    this.invalidate('targetUser', 'No se puede apostar por uno mismo', this.targetUser);
  }
});

// Una sola apuesta por usuario y por subasta (docs/REGLAS.md §5).
sideBetSchema.index({ auction: 1, bettor: 1 }, { unique: true });

export const SideBet = model<ISideBet>('SideBet', sideBetSchema);
