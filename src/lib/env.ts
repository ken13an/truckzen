const SERVER_ONLY_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'TWILIO_AUTH_TOKEN',
] as const

export function getEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value : undefined
}

export function validateServerEnv() {
  const required = [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missing = required.filter((name) => !process.env[name] || process.env[name]?.trim().length === 0)
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  if (typeof window !== 'undefined') return

  for (const key of SERVER_ONLY_KEYS) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      throw new Error(`Server-only key cannot be public: ${key}`)
    }
  }
}
