import { Router } from 'express';
import { auctionRouter } from './auction.routes.js';
import { authRouter } from './auth.routes.js';
import { curseRouter } from './curse.routes.js';
import { houseRouter } from './house.routes.js';
import { objectRouter } from './object.routes.js';
import { userRouter } from './user.routes.js';

/** Router raíz de la API, montado en /api. */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/curses', curseRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/houses', houseRouter);
apiRouter.use('/objects', objectRouter);
apiRouter.use('/auctions', auctionRouter);
