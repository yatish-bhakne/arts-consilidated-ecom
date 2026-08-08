import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ValidationError } from '../errors/AppError';

type RequestPart = 'query' | 'params' | 'body';

/**
 * Parses `req[part]` against `schema`, replaces it with the parsed
 * (coerced/defaulted) value, and throws a typed ValidationError on mismatch
 * so the central error handler can map it to a 400 uniformly.
 */
export function validate<TSchema extends ZodTypeAny>(part: RequestPart, schema: TSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationError(`Invalid ${part}`, result.error.flatten().fieldErrors));
      return;
    }
    req[part] = result.data as z.infer<TSchema>;
    next();
  };
}
