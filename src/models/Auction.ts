import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions, integerValidator } from '../utils/schemaOptions.js';

export const AUCTION_STATUSES = ['scheduled', 'open', 'closed', 'cancelled'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

/** Motivos de cancelación definidos en docs/REGLAS.md §2. */
export const CANCELLATION_REASONS = ['no_unique_bids', 'no_bids'] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export interface IAuction {
  _id: Types.ObjectId;
  object: Types.ObjectId;
  status: AuctionStatus;
  opensAt: Date;
  closesAt: Date;
  winner?: Types.ObjectId;
  winningBid?: number;
  cancellationReason?: CancellationReason;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const auctionSchema = new Schema<IAuction>(
  {
    object: {
      type: Schema.Types.ObjectId,
      ref: 'CursedObject',
      required: [true, 'La subasta debe indicar el objeto subastado'],
    },
    status: {
      type: String,
      enum: {
        values: AUCTION_STATUSES,
        message: 'El estado debe ser scheduled, open, closed o cancelled',
      },
      default: 'scheduled',
    },
    opensAt: { type: Date, required: [true, 'La fecha de apertura es obligatoria'] },
    closesAt: { type: Date, required: [true, 'La fecha de cierre es obligatoria'] },
    winner: { type: Schema.Types.ObjectId, ref: 'User' },
    winningBid: {
      type: Number,
      min: [1, 'La puja ganadora debe ser al menos 1'],
      validate: integerValidator('La puja ganadora'),
    },
    cancellationReason: {
      type: String,
      enum: {
        values: CANCELLATION_REASONS,
        message: 'El motivo de cancelación debe ser no_unique_bids o no_bids',
      },
    },
    resolvedAt: { type: Date },
  },
  baseSchemaOptions,
);

// Validación entre campos. Corre en save()/validate(), NO en findOneAndUpdate.
auctionSchema.pre('validate', async function () {
  if (this.opensAt && this.closesAt && this.closesAt <= this.opensAt) {
    this.invalidate(
      'closesAt',
      'La fecha de cierre debe ser posterior a la fecha de apertura',
      this.closesAt,
    );
  }
});

// Listados por estado y búsqueda de subastas vencidas para el cierre automático.
auctionSchema.index({ status: 1, closesAt: 1 });
auctionSchema.index({ object: 1 });

export const Auction = model<IAuction>('Auction', auctionSchema);

export type AuctionDocument = HydratedDocument<IAuction>;
