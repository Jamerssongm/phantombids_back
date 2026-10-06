import type { UserDocument } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado, recargado desde la base por el middleware `autenticar`. */
      user?: UserDocument;
    }
  }
}

export {};
