'use client'
import { COLORS, FONT } from '@/lib/config/colors'
import { Loader2 } from 'lucide-react'

interface Props { message?: string }

export function LoadingState({ message = 'Loading...' }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', fontFamily: FONT,
    }}>
      <Loader2 size={28} color={COLORS.blue} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <p style={{ color: COLORS.textSecondary, fontSize: 14 }}>{message}</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
