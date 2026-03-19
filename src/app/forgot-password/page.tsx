'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, XCircle } from 'lucide-react'
import Logo from '@/components/Logo'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Enter your email address'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })
    if (err) { setError('Could not send reset email. Check the address and try again.'); setLoading(false); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className="w-full max-w-[400px] bg-surface border border-brand-border rounded-xl p-8 shadow-2xl">
        {/* Logo */}
        <Logo size="md" className="mb-7" />

        {sent ? (
          <div className="text-center py-4">
            <Mail size={40} strokeWidth={1.5} className="text-teal mx-auto mb-4" />
            <h1 className="text-lg font-bold text-text-primary mb-2">Check your email</h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              We sent a password reset link to <strong className="text-text-primary">{email}</strong>. Check your inbox and click the link.
            </p>
            <a href="/login" className="inline-block mt-6 text-sm text-teal no-underline hover:underline">Back to login</a>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-1">Reset password</h1>
            <p className="text-sm text-text-secondary mb-7">Enter your work email and we will send a reset link.</p>
            <form onSubmit={handleSubmit}>
              <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1.5 block">Email</label>
              <input type="email" autoFocus required value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="you@yourshop.com"
                className="w-full px-3.5 py-2.5 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150 min-h-[44px]" />
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-error/10 border border-error/20 rounded-md text-xs text-error mt-3">
                  <XCircle size={14} strokeWidth={1.5} className="shrink-0" /> {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className={`w-full py-3 rounded-md text-sm font-bold mt-4 min-h-[48px] transition-all duration-150 ${loading ? 'bg-surface-2 text-text-secondary cursor-not-allowed' : 'bg-teal text-bg hover:bg-teal-hover cursor-pointer'}`}>
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Sending...</span> : 'Send Reset Link'}
              </button>
            </form>
            <a href="/login" className="block text-center mt-5 text-xs text-text-tertiary no-underline hover:text-teal transition-colors">Back to login</a>
          </>
        )}
      </div>
    </div>
  )
}
