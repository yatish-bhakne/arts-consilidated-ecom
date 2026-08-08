export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  // `details` is a plain field-name -> messages map, not tied to any
  // particular validation library, so this class stays reusable outside the
  // HTTP-edge validation middleware if a service ever needs to reject a
  // business rule the same way.
  constructor(
    message: string,
    public readonly details?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}
