import { Schema, model, type Types } from 'mongoose';
import { baseSchemaOptions, integerValidator } from '../utils/schemaOptions.js';

/**
 * Puja secreta. Que el monto caiga dentro de [minBid, maxBid] del objeto y que la
 * subasta esté abierta son reglas de NEGOCIO: se validan en services/, no acá.
 */
export interface IBid {
  _id: Types.ObjectId;
  auction: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  isDuplicate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bidSchema = new Schema<IBid>(
  {
    auction: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'La puja debe indicar la subasta'],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'La puja debe indicar el usuario'],
    },
    amount: {
      type: Number,
      required: [true, 'El monto de la puja es obligatorio'],
      min: [1, 'El monto de la puja debe ser al menos 1'],
      validate: integerValidator('El monto de la puja'),
    },
    isDuplicate: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

// UN USUARIO, UNA PUJA POR SUBASTA (docs/REGLAS.md §2). Es una restricción
// estructural del producto: la subasta de puja única pierde sentido si alguien
// puede ofrecer varios montos. El índice único la garantiza incluso ante dos
// peticiones simultáneas, cosa que un chequeo previo en el service no puede.
bidSchema.index({ auction: 1, user: 1 }, { unique: true });
// Agrupar por monto al resolver la subasta.
bidSchema.index({ auction: 1, amount: 1 });

export const Bid = model<IBid>('Bid', bidSchema);
