'use client'
import { FONT } from '@/lib/config/colors'
import { useTheme } from '@/hooks/useTheme'
import { Loader2 } from 'lucide-react'

interface Props { message?: string }

export function LoadingState({ message = 'Loading...' }: Props) {
  const { tokens: t } = useTheme()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', fontFamily: FONT,
    }}>
      <Loader2 size={28} color={'var(--tz-accent)'} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <p style={{ color: 'var(--tz-textSecondary)', fontSize: 14 }}>{message}</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
