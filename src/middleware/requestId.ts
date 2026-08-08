import type { NextFunction, Request, Response } from 'express';

/**
 * Echoes the request id (assigned upstream by pino-http) back as a response
 * header, so a client/log correlation works in both directions.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  // genReqId in app.ts always returns a string, despite pino-http's wider ReqId type.
  res.setHeader('x-request-id', req.id as string);
  next();
}
