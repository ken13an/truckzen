import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

type RouteHandler = (req: Request, ctx?: any) => Promise<Response>

/**
 * Wraps a Next.js API route handler with standardized unexpected-error handling.
 * - Catches unexpected exceptions only (does not change expected/business error responses).
 * - Captures to Sentry if configured.
 * - Returns a safe 500 JSON response without leaking internals.
 */
export function safeRoute(handler: RouteHandler): RouteHandler {
  return async (req: Request, ctx?: any) => {
    try {
      return await handler(req, ctx)
    } catch (err: unknown) {
      const method = req.method || 'UNKNOWN'
      const url = req.url || ''

      Sentry.captureException(err, {
        extra: { method, url },
      })

      // Safe console log for server-side observability (no secrets/stack to client)
      console.error(`[api-handler] ${method} ${url}`, err)

      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again or contact support.' },
        { status: 500 },
      )
    }
  }
}
