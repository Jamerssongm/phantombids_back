import { Schema, model, type Types } from 'mongoose';
import { URL_PATTERN, baseSchemaOptions, integerValidator } from '../utils/schemaOptions.js';

export interface ICursedObject {
  _id: Types.ObjectId;
  name: string;
  imageUrl?: string;
  house: Types.ObjectId;
  curse: Types.ObjectId;
  minBid: number;
  maxBid: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const cursedObjectSchema = new Schema<ICursedObject>(
  {
    name: {
      type: String,
      required: [true, 'El nombre del objeto es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre del objeto debe tener al menos 3 caracteres'],
      maxlength: [80, 'El nombre del objeto no puede superar los 80 caracteres'],
    },
    imageUrl: {
      type: String,
      trim: true,
      match: [URL_PATTERN, 'La imagen debe ser una URL http(s) válida'],
    },
    house: {
      type: Schema.Types.ObjectId,
      ref: 'HauntHouse',
      required: [true, 'El objeto debe pertenecer a una casa'],
    },
    curse: {
      type: Schema.Types.ObjectId,
      ref: 'Curse',
      required: [true, 'El objeto debe tener una maldición asociada'],
    },
    minBid: {
      type: Number,
      required: [true, 'La puja mínima es obligatoria'],
      min: [1, 'La puja mínima debe ser al menos 1'],
      validate: integerValidator('La puja mínima'),
    },
    maxBid: {
      type: Number,
      required: [true, 'La puja máxima es obligatoria'],
      min: [1, 'La puja máxima debe ser al menos 1'],
      validate: integerValidator('La puja máxima'),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El objeto debe tener un creador'],
    },
  },
  baseSchemaOptions,
);

// Validación entre campos. Corre en save()/validate(), NO en findOneAndUpdate:
// los services deben actualizar con doc.save() para que se aplique.
cursedObjectSchema.pre('validate', async function () {
  if (this.minBid != null && this.maxBid != null && this.maxBid <= this.minBid) {
    this.invalidate(
      'maxBid',
      `La puja máxima (${this.maxBid}) debe ser mayor que la puja mínima (${this.minBid})`,
      this.maxBid,
    );
  }
});

cursedObjectSchema.index({ house: 1 });

export const CursedObject = model<ICursedObject>('CursedObject', cursedObjectSchema);
