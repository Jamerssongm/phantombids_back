import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createRequire } from 'node:module';
import { getDbStatus } from './config/database.js';
import { env } from './config/env.js';

const API_NAME = 'PhantomBids API';
// package.json queda fuera de rootDir: se lee en runtime (src/ y dist/ están al mismo nivel).
const { version: API_VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

export const app = express();

app.use(helmet());
app.use(cors({ origin: [...env.CORS_ORIGIN] }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
if (!env.isProduction) app.use(morgan('dev'));

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { name: API_NAME, version: API_VERSION, docs: '/api/docs' },
  });
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

// TODO(b01): reemplazar por el middleware global de errores con AppError.
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
      details: [],
    },
  });
});
