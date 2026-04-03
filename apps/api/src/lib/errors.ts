import type { Context } from "hono";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function errorResponse(c: Context, error: AppError | Error) {
  if (error instanceof AppError) {
    return c.json({ error: error.message, code: error.code }, error.statusCode as any);
  }
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
}
