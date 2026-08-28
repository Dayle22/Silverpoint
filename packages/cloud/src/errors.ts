// Structured error handling for @open-pencil/cloud

export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid_request'
  | 'upstream_unavailable'
  | 'internal_error';

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class APIError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static unauthenticated(message = 'Authentication required'): APIError {
    return new APIError(401, 'unauthenticated', message);
  }

  static forbidden(message = 'Access forbidden'): APIError {
    return new APIError(403, 'forbidden', message);
  }

  static notFound(resource = 'Resource'): APIError {
    return new APIError(404, 'not_found', `${resource} not found`);
  }

  static conflict(message = 'Conflict with existing resource'): APIError {
    return new APIError(409, 'conflict', message);
  }

  static invalidRequest(message = 'Invalid request parameters', details?: Record<string, unknown>): APIError {
    return new APIError(400, 'invalid_request', message, details);
  }

  static upstreamUnavailable(service = 'Upstream service'): APIError {
    return new APIError(503, 'upstream_unavailable', `${service} temporarily unavailable`);
  }

  static internal(message = 'An unexpected internal error occurred'): APIError {
    return new APIError(500, 'internal_error', message);
  }
}

export function createErrorResponse(error: unknown): Response {
  if (error instanceof APIError) {
    const body: ErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    return new Response(JSON.stringify(body), {
      status: error.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Generic fallback for uncaught exceptions - never leak stack traces or internals
  const body: ErrorResponseBody = {
    error: {
      code: 'internal_error',
      message: 'An internal server error occurred',
    },
  };

  return new Response(JSON.stringify(body), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
