// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  enabled: process.env.NODE_ENV === 'production',
  beforeSend(event) {
    // Strip sensitive data before sending to Sentry
    if (event.request?.cookies) delete event.request.cookies
    if (event.request?.headers?.authorization) delete event.request.headers.authorization
    return event
  },
})
