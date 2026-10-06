import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { curseRouter } from './curse.routes.js';
import { userRouter } from './user.routes.js';

/** Router raíz de la API, montado en /api. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/curses', curseRouter);
apiRouter.use('/users', userRouter);
