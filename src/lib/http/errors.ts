/**
 * Defines the shared application error shape for route handlers and services.
 * Called by middleware, validation, services, and repositories whenever a request must fail intentionally.
 * Calls no persistence code so error construction stays side-effect free.
 * A junior engineer often throws raw Error objects and loses status codes, machine-readable codes, and client-safe messages.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function unauthorizedError(code: string, message: string) {
  return new AppError(401, code, message);
}

export function forbiddenError(code: string, message: string) {
  return new AppError(403, code, message);
}

export function notFoundError(code: string, message: string) {
  return new AppError(404, code, message);
}

export function conflictError(code: string, message: string, details?: unknown) {
  return new AppError(409, code, message, details);
}

export function validationError(message: string, details?: unknown) {
  return new AppError(422, "validation_error", message, details);
}
