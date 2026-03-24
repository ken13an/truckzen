// @ts-check
/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevents your app being embedded in iframes — blocks clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Stops browsers guessing content types — blocks MIME-type attacks
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Forces HTTPS for 1 year, including subdomains
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Controls what your pages can load — core XSS protection
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + Stripe (payment widget) + inline for Next.js
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
      // Styles: self + Google Fonts + inline
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: self + data URIs + HTTPS (for truck/customer photos later)
      "img-src 'self' data: blob: https:",
      // API connections: self + Supabase + Claude API + Stripe
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.stripe.com https://api.twilio.com",
      // Stripe payment iframe
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      // Worker scripts for Next.js
      "worker-src 'self' blob:",
      // Media (voice recording for AI writer)
      "media-src 'self' blob:",
      // Prevent page from being embedded
      "frame-ancestors 'none'",
      // Restrict base URI
      "base-uri 'self'",
      // Restrict form targets
      "form-action 'self'",
    ].join('; '),
  },
  // Stops referrer leaking sensitive URL info to third parties
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Block browser features the app doesn't need
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',              // no camera access
      'microphone=(self)',      // microphone only on same origin (AI voice writer)
      'geolocation=()',         // no GPS from browser (use Samsara API instead)
      'payment=()',             // no payment request API (using Stripe embed)
      'usb=()',
      'bluetooth=()',
    ].join(', '),
  },
  // Legacy XSS protection for older browsers
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Prevent DNS prefetch leaking visited pages
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
]

const nextConfig = {
  // ── SECURITY HEADERS ──────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Extra cache control for API routes — never cache auth responses
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ]
  },

  // ── REDIRECTS ─────────────────────────────────────────────
  async redirects() {
    return [
      // Root → dashboard (middleware handles auth check)
      {
        source: '/app',
        destination: '/dashboard',
        permanent: false,
      },
    ]
  },

  // ── IMAGES ────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        // Supabase Storage for truck photos, avatars, document uploads
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Optimize all images — reduces bandwidth
    formats: ['image/avif', 'image/webp'],
  },

  // ── TYPESCRIPT ────────────────────────────────────────────
  typescript: {
    // Fail the build if there are TypeScript errors
    ignoreBuildErrors: false,
  },

  // ── ESLINT ───────────────────────────────────────────────
  eslint: {
    ignoreDuringBuilds: false,
  },

  // ── EXPERIMENTAL ─────────────────────────────────────────
  experimental: {
    // Server components can read cookies without extra config
    serverActions: {
      allowedOrigins: ['truckzen.com', 'www.truckzen.com'],
    },
    optimizeCss: true,
  },

  // ── ENV VALIDATION ───────────────────────────────────────
  // These must be present at build time — build fails if missing
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // ── PERFORMANCE ──────────────────────────────────────────
  compress: true,
  poweredByHeader: false, // Remove X-Powered-By: Next.js header (security)

  // ── LOGGING ──────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
}

// Wrap with Sentry if DSN is configured
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG || '',
  project: process.env.SENTRY_PROJECT || '',
  disableLogger: true,
}, {
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
