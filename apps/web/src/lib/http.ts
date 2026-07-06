import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, init?: number): NextResponse {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(message: string, status = 400, extra?: unknown): NextResponse {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/** route handler 를 감싸 일관된 에러 처리를 제공. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail('입력값이 올바르지 않습니다.', 422, err.flatten());
      }
      const message = err instanceof Error ? err.message : '서버 오류가 발생했습니다.';
      console.error('[api] error:', err);
      return fail(message, 500);
    }
  };
}
