/*
 * ████████████████████████████████████████████████████████████████████████████
 * TODO(b06): BORRAR ESTE ARCHIVO EN LA SESIÓN 6 (y su montaje en app.ts).
 *
 * Rutas TEMPORALES para demostrar el manejo de errores (criterio 6). Solo se
 * montan fuera de producción. Acceden a modelos directamente, cosa que la regla
 * de capas prohíbe en código real: es aceptable únicamente porque se borra.
 * ████████████████████████████████████████████████████████████████████████████
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { validate } from '../middlewares/validate.js';
import { Auction, Bid, CursedObject } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { ok, paginated } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { mongoIdParam, paginationQuery, trimmedString } from '../utils/validators.js';

export const testRouter = Router();

// AppError → su propio statusCode
testRouter.get('/app-error', () => {
  throw AppError.conflict('La subasta ya está cerrada', [], 'AUCTION_CLOSED');
});

// ValidationError de Mongoose → 422 con detalle por campo
testRouter.get(
  '/mongoose-validation',
  asyncHandler(async () => {
    await new CursedObject({ name: 'X', minBid: 100, maxBid: 50, house: 'no-es-id' }).validate();
  }),
);

// CastError (ObjectId inválido llegando a Mongoose) → 400
testRouter.get(
  '/cast/:id',
  asyncHandler<{ id: string }>(async (req) => {
    await Auction.findById(req.params.id);
  }),
);

// E11000 → 409 con mensaje legible según el índice (bids.auction_1_user_1)
testRouter.post(
  '/duplicate',
  asyncHandler(async () => {
    const auction = new Types.ObjectId();
    const user = new Types.ObjectId();
    try {
      await Bid.create({ auction, user, amount: 10 });
      await Bid.create({ auction, user, amount: 20 });
    } finally {
      await Bid.deleteMany({ auction });
    }
  }),
);

// JSON mal formado → body-parser lanza SyntaxError → 400
testRouter.post('/echo', (req, res) => {
  ok(res, req.body);
});

// express-validator en body → 422
testRouter.post(
  '/express-validator',
  validate([trimmedString('name', { min: 3, max: 20 }), trimmedString('password', { min: 8 })]),
  (req, res) => {
    ok(res, req.body);
  },
);

// express-validator en params → 400
testRouter.get('/mongo-id/:id', validate([mongoIdParam()]), (req, res) => {
  ok(res, { id: req.params.id });
});

// Paginación: page/limit validados; limit > 100 se recorta
testRouter.get('/paginated', validate(paginationQuery), (req, res) => {
  const { skip, ...pagination } = getPagination(req.query);
  const total = 250;
  const items = Array.from(
    { length: Math.max(0, Math.min(pagination.limit, total - skip)) },
    (_, i) => skip + i + 1,
  );
  paginated(res, items, buildMeta(total, pagination));
});

// JsonWebTokenError / TokenExpiredError → 401
testRouter.get('/jwt-invalid', () => {
  jwt.verify('esto.no.es-un-token', env.JWT_SECRET);
});
testRouter.get('/jwt-expired', () => {
  const token = jwt.sign({ sub: 'x', exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
  jwt.verify(token, env.JWT_SECRET);
});

// throw no controlado (sync y async) → 500, sin stack en producción
testRouter.get('/crash', () => {
  throw new Error('Explosión no controlada (sync)');
});
testRouter.get(
  '/crash-async',
  asyncHandler(async () => {
    await Promise.resolve();
    (undefined as unknown as { boom: () => void }).boom();
  }),
);
