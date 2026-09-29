/**
 * Converts service results and AppError failures into consistent HTTP responses.
 * Called by REST route handlers under src/app/api.
 * Calls NextResponse and AppError utilities so API routes stay very small.
 * A junior engineer often returns different error shapes from every route and makes clients brittle.
 */
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/http/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: error.flatten()
        }
      },
      { status: 422 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "internal_server_error",
        message: "An unexpected error occurred."
      }
    },
    { status: 500 }
  );
}

export async function route<T>(handler: () => Promise<Response | T>) {
  try {
    const result = await handler();
    return result instanceof Response ? result : ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
