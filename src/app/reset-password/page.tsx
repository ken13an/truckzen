'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, XCircle, CheckCircle2, ShieldX } from 'lucide-react'
import Logo from '@/components/Logo'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [validSession, setValid] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setValid(true); setChecking(false)
      }
    })
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession() as any
      if (session) setValid(true)
      setChecking(false)
    }, 2000)
    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setTimeout(() => window.location.href = '/login', 2000)
  }

  const card = "w-full max-w-[400px] bg-surface border border-brand-border rounded-xl p-8 shadow-2xl"

  if (checking) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className={`${card} text-center`}>
        <Loader2 size={24} className="animate-spin text-teal mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Verifying reset link...</p>
      </div>
    </div>
  )

  if (!validSession) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className={`${card} text-center`}>
        <ShieldX size={40} strokeWidth={1.5} className="text-error mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary mb-2">Link Expired</h1>
        <p className="text-sm text-text-secondary mb-6">This reset link has expired or already been used.</p>
        <a href="/forgot-password" className="inline-block w-full py-3 bg-teal text-bg rounded-md text-sm font-bold text-center hover:bg-teal-hover transition-colors no-underline">
          Request New Link
        </a>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className={`${card} text-center`}>
        <CheckCircle2 size={40} strokeWidth={1.5} className="text-success mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary mb-2">Password Updated</h1>
        <p className="text-sm text-text-secondary">Redirecting you to login...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className={card}>
        <Logo size="sm" className="mb-6" />
        <h1 className="text-xl font-bold text-text-primary mb-1">Set New Password</h1>
        <p className="text-sm text-text-secondary mb-6">Choose a strong password for your account.</p>
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-error/10 border border-error/20 rounded-md text-xs text-error mb-4">
            <XCircle size={14} strokeWidth={1.5} className="shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1.5 block">New Password</label>
            <input type="password" autoFocus required value={password} onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="At least 8 characters"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150 min-h-[44px]" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest font-mono mb-1.5 block">Confirm Password</label>
            <input type="password" required value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }}
              placeholder="Same password again"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-brand-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-teal transition-colors duration-150 min-h-[44px]" />
          </div>
          <button type="submit" disabled={loading}
            className={`w-full py-3 rounded-md text-sm font-bold mt-1 min-h-[48px] transition-all duration-150 ${loading ? 'bg-surface-2 text-text-secondary cursor-not-allowed' : 'bg-teal text-bg hover:bg-teal-hover cursor-pointer'}`}>
            {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Updating...</span> : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
