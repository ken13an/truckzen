// TruckZen Logo — brand book compliant
// Icon: white rounded square with bold TZ + teal dot bottom-right
// Wordmark: "truck" in white, "zen." in teal #00E0B0

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}

export function LogoIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 24 : size === 'lg' ? 40 : 32
  return (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#FFFFFF" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="20" fill="#0A0A0A" letterSpacing="-0.5">
        TZ
      </text>
      <circle cx="33" cy="33" r="3.5" fill="#00E0B0" />
    </svg>
  )
}

export function LogoWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
  return (
    <span className={`${cls} font-bold tracking-wide`}>
      <span className="text-[#FFFFFF]">truck</span>
      <span className="text-[#00E0B0]">zen.</span>
    </span>
  )
}

export default function Logo({ size = 'md', showWordmark = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} />
      {showWordmark && <LogoWordmark size={size} />}
    </div>
  )
}
