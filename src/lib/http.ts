import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard error responses. Crucially these NEVER echo internal error messages,
 * stack traces, or database details to the client — that would leak private data
 * and implementation details. Details are logged server-side only.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    public publicMessage: string,
  ) {
    super(publicMessage);
  }
}

export const Errors = {
  unauthorized: () => new HttpError(401, 'Authentication required.'),
  forbidden: () => new HttpError(403, 'You do not have permission to do that.'),
  notFound: () => new HttpError(404, 'Not found.'),
  badRequest: (msg = 'Invalid request.') => new HttpError(400, msg),
  rateLimited: () => new HttpError(429, 'Too many requests. Please slow down.'),
  payment: (msg = 'Your current plan does not include this feature.') => new HttpError(402, msg),
  conflict: (msg = 'Conflict.') => new HttpError(409, msg),
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wrap an API handler so thrown HttpError/ZodError become safe responses. */
export function handle(fn: () => Promise<Response> | Response) {
  return Promise.resolve()
    .then(fn)
    .catch((err: unknown) => {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.publicMessage }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed.',
            fields: err.flatten().fieldErrors,
          },
          { status: 422 },
        );
      }
      // Unknown error: log server-side, return a generic message.
      console.error('[api] unhandled error:', err);
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 },
      );
    });
}
