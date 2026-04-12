// TruckZen Logo — brand book
// Icon: white rounded square, bold TZ, blue dot bottom-left
// Wordmark: "truck" white, "zen." blue #1D6FE8

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
  style?: React.CSSProperties
}

export function LogoIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 24 : size === 'lg' ? 40 : 32
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#FFFFFF" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="20" fill="#0A0A0A" letterSpacing="-0.5">
        TZ
      </text>
      <circle cx="9" cy="33" r="3.5" fill="#1D6FE8" />
    </svg>
  )
}

export function LogoWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'sm' ? '14px' : size === 'lg' ? '18px' : '16px'
  // "truck" inherits theme color (currentColor) so it adapts to warm/dark mode.
  // "zen." stays brand blue — canonical brand color, never themed.
  return (
    <span style={{ fontSize, fontWeight: 700, letterSpacing: '0.02em', fontFamily: "'Instrument Sans', -apple-system, sans-serif", color: 'currentColor' }}>
      <span>truck</span>
      <span style={{ color: '#1D6FE8' }}>zen.</span>
    </span>
  )
}

export default function Logo({ size = 'md', showWordmark = true, className, style }: LogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', ...style }}>
      <LogoIcon size={size} />
      {showWordmark && <LogoWordmark size={size} />}
    </div>
  )
}
