import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createRequire } from 'node:module';
import { getDbStatus } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { testRouter } from './routes/_test.routes.js';
import { AppError } from './utils/AppError.js';
import { ok } from './utils/apiResponse.js';

const API_NAME = 'PhantomBids API';
// package.json queda fuera de rootDir: se lee en runtime (src/ y dist/ están al mismo nivel).
const { version: API_VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

export const app = express();

// morgan va primero: si va después de express.json(), las peticiones con JSON mal
// formado fallan antes de llegar a él y nunca quedan registradas.
if (!env.isProduction) app.use(morgan('dev'));
app.use(helmet());
app.use(cors({ origin: [...env.CORS_ORIGIN] }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/', (_req: Request, res: Response) => {
  ok(res, { name: API_NAME, version: API_VERSION, docs: '/api/docs' });
});

// Render y los monitores leen el código de estado: base caída => 503, no 200.
app.get('/health', (_req: Request, res: Response) => {
  const db = getDbStatus();
  const healthy = db === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    db,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

if (!env.isProduction) {
  // TODO(b06): quitar junto con src/routes/_test.routes.ts.
  app.use('/api/_test', testRouter);
}

// 404: toda ruta no encontrada pasa por el mismo camino que cualquier otro error.
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
});

// Global: SIEMPRE el último middleware.
app.use(errorHandler);
