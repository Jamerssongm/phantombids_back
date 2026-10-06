import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { curseRouter } from './curse.routes.js';

/** Router raíz de la API, montado en /api. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/curses', curseRouter);
