'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ROLE_REDIRECT } from '@/lib/permissions'
import { Eye, EyeOff, XCircle, Loader2 } from 'lucide-react'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (session) {
        await redirectByRole(session.user.id)
      } else {
        setCheckingSession(false)
      }
    })
  }, [])

  async function redirectByRole(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from('users').select('role, shop_id').eq('id', userId).single()

    if (profileError || !profile) {
      setError('Account not set up yet. Ask your admin.')
      setLoading(false)
      setCheckingSession(false)
      return
    }

    const { data: shop } = await supabase
      .from('shops').select('setup_complete').eq('id', profile.shop_id).single()

    if (shop && !shop.setup_complete) {
      router.replace(profile.role === 'office_admin' || profile.role === 'owner' ? '/setup' : '/waiting')
      return
    }

    router.replace(ROLE_REDIRECT[profile.role] ?? '/dashboard')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Enter your email and password.'); return }

    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    })

    if (authError) {
      setLoading(false)
      if (authError.message.includes('Invalid login') || authError.message.includes('Email not confirmed') || authError.message.includes('Invalid email')) {
        setError('Incorrect email or password.')
      } else if (authError.message.includes('Too many')) {
        setError('Too many attempts. Wait a few minutes and try again.')
      } else {
        setError('Login failed. Contact your admin if this continues.')
      }
      return
    }

    if (!data.user) { setLoading(false); setError('Login failed. Try again.'); return }
    await redirectByRole(data.user.id)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#08080C] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#00E0B0]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08080C] flex flex-col items-center justify-center p-5 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse, rgba(0,224,176,0.06) 0%, transparent 70%)' }} />

      <div className="w-full max-w-[400px] bg-[#111117] border border-[#28283A] rounded-xl p-8 relative z-10 shadow-2xl">
        {/* Logo */}
        <Logo size="md" className="mb-7" />

        {/* Heading */}
        <h1 className="text-xl font-bold text-[#EDEDF0] mb-1">Welcome back</h1>
        <p className="text-sm text-[#9898A5] mb-7">Sign in to your shop account</p>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[10px] font-bold text-[#5A5A68] uppercase tracking-widest font-mono">
              Email
            </label>
            <input
              id="email" type="email" autoComplete="email" autoFocus required
              value={email} onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@yourshop.com" disabled={loading}
              className="w-full px-3.5 py-2.5 bg-[#1C1C24] border border-[#28283A] rounded-md text-sm text-[#EDEDF0] placeholder:text-[#5A5A68] outline-none focus:border-[#00E0B0] transition-colors duration-150 min-h-[44px]"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[10px] font-bold text-[#5A5A68] uppercase tracking-widest font-mono">
              Password
            </label>
            <div className="relative">
              <input
                id="password" type={showPass ? 'text' : 'password'} autoComplete="current-password" required
                value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter password" disabled={loading}
                className="w-full px-3.5 py-2.5 pr-11 bg-[#1C1C24] border border-[#28283A] rounded-md text-sm text-[#EDEDF0] placeholder:text-[#5A5A68] outline-none focus:border-[#00E0B0] transition-colors duration-150 min-h-[44px]"
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPass(p => !p)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5A68] hover:text-[#9898A5] transition-colors duration-150 p-1"
              >
                {showPass ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 rounded-md text-xs text-[#FF6B6B] leading-snug">
              <XCircle size={14} strokeWidth={1.5} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={loading}
            className={`w-full py-3 rounded-md text-sm font-bold mt-1 min-h-[48px] transition-all duration-150 ${
              loading
                ? 'bg-[#1C1C24] border border-[#28283A] text-[#9898A5] cursor-not-allowed'
                : 'bg-[#00E0B0] text-[#08080C] hover:bg-[#00B892] cursor-pointer shadow-[0_0_16px_rgba(0,224,176,0.25)]'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Forgot password */}
        <div className="text-center mt-4">
          <a href="/forgot-password" className="text-xs text-[#00E0B0] hover:underline no-underline">
            Forgot password?
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-[#5A5A68] mt-6 pt-5 border-t border-[#28283A]">
          No account? Contact your shop admin.
        </div>
      </div>

      {/* Bottom branding */}
      <div className="fixed bottom-4 text-[10px] text-[#5A5A68] tracking-wider z-10 font-mono">
        Powered by TruckZen &middot; Where Every Process Finds Its Calm
      </div>
    </div>
  )
}
