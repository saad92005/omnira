/**
 * Typed error hierarchy. Application code throws these, never a bare `Error`.
 * REST handlers (apps/api) translate any `OmniraError` into the standard
 * envelope; anything that reaches the handler as a plain `Error` is a bug,
 * not a normal failure path.
 */

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export abstract class OmniraError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }

  toEnvelope(requestId: string): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
        requestId,
      },
    };
  }
}

export class ValidationError extends OmniraError {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 400;
}

export class UnauthorizedError extends OmniraError {
  readonly code = "UNAUTHORIZED";
  readonly httpStatus = 401;
}

export class ForbiddenError extends OmniraError {
  readonly code = "FORBIDDEN";
  readonly httpStatus = 403;
}

export class NotFoundError extends OmniraError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;
}

export class ConflictError extends OmniraError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;
}

/** A dependency (model provider, STT/TTS vendor, DB) failed or is unreachable. */
export class UpstreamError extends OmniraError {
  readonly code = "UPSTREAM_ERROR";
  readonly httpStatus = 502;
}

export class InternalError extends OmniraError {
  readonly code = "INTERNAL_ERROR";
  readonly httpStatus = 500;
}

/** Narrows an unknown catch-clause value into an OmniraError, wrapping if needed. */
export function toOmniraError(err: unknown): OmniraError {
  if (err instanceof OmniraError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new InternalError(message);
}
