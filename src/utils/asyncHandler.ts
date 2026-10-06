import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envuelve un handler async para que cualquier rechazo llegue a next() y, por lo
 * tanto, al errorHandler global. En Express 4 un await que falla sin esto queda
 * como unhandledRejection y la petición nunca se responde.
 *
 * Los genéricos se infieren desde el uso, así que no hace falta castear:
 *   router.get('/:id', asyncHandler<{ id: string }>(async (req, res) => { req.params.id }))
 */
export function asyncHandler<
  P = Request['params'],
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Request['query'],
>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
