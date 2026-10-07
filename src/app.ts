import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { createRequire } from 'node:module';
import { getDbStatus } from './config/database.js';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { AppError } from './utils/AppError.js';
import { ok } from './utils/apiResponse.js';

const API_NAME = 'PhantomBids API';
// package.json queda fuera de rootDir: se lee en runtime (src/ y dist/ están al mismo nivel).
const { version: API_VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

export const app = express();

// Render pone un proxy delante: sin esto, req.ip sería la IP del proxy y el rate
// limit contaría a todos los clientes como uno solo. SOLO en producción: en local
// no hay proxy, y confiar en X-Forwarded-For permitiría falsear la IP y esquivar
// el rate limit mandando un header distinto en cada intento.
if (env.isProduction) app.set('trust proxy', 1);

// morgan va primero: si va después de express.json(), las peticiones con JSON mal
// formado fallan antes de llegar a él y nunca quedan registradas.
if (!env.isProduction) app.use(morgan('dev'));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // upgrade-insecure-requests fuerza https en los recursos de Swagger UI: en
        // local (http) los rompería. En producción (Render, https) se mantiene.
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
  }),
);
app.use(cors({ origin: [...env.CORS_ORIGIN] }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

/**
 * @openapi
 * /:
 *   get:
 *     tags:
 *     - Sistema
 *     summary: Información de la API
 *     responses:
 *       200:
 *         $ref: '#/components/responses/ApiInfoOk'
 */
app.get('/', (_req: Request, res: Response) => {
  ok(res, { name: API_NAME, version: API_VERSION, docs: '/api/docs' });
});

// Render y los monitores leen el código de estado: base caída => 503, no 200.
/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *     - Sistema
 *     summary: Estado del servicio y de la base
 *     responses:
 *       200:
 *         description: Servicio sano y base conectada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                 db:
 *                   type: string
 *                   enum:
 *                   - connected
 *                   - disconnected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *       503:
 *         description: Base desconectada (status "degraded"). Render usa este código como health check.
 */
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

// Documentación: UI en /api/docs y la especificación cruda en /api/docs.json.
app.get('/api/docs.json', (_req: Request, res: Response) => {
  res.json(swaggerSpec);
});
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'PhantomBids API — Docs',
    swaggerOptions: { persistAuthorization: true },
  }),
);

app.use('/api', apiRouter);

// 404: toda ruta no encontrada pasa por el mismo camino que cualquier otro error.
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
});

// Global: SIEMPRE el último middleware.
app.use(errorHandler);
