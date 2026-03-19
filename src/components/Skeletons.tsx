'use client'

const pulse = `
  @keyframes pulse {
    0%, 100% { opacity: 1 }
    50%       { opacity: 0.4 }
  }
`

function Bone({ w = '100%', h = 16, radius = 6, style = {} }: {
  w?: string | number; h?: number; radius?: number; style?: React.CSSProperties
}) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'rgba(255,255,255,.06)',
      animation: 'pulse 1.5s ease-in-out infinite',
      flexShrink: 0, ...style,
    }}/>
  )
}

// ── TABLE SKELETON ────────────────────────────────────────────
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, overflow: 'hidden' }}>
      <style>{pulse}</style>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, padding: '10px 14px', background: '#08080C', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        {Array.from({ length: cols }).map((_, i) => <Bone key={i} w={`${60 + Math.random() * 60}px`} h={8}/>)}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.025)', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} w={j === 0 ? '80px' : j === cols - 1 ? '60px' : `${40 + Math.random() * 100}%`} h={12}/>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── STAT CARDS SKELETON ───────────────────────────────────────
export function StatsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
      <style>{pulse}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 10, padding: '12px 14px' }}>
          <Bone w="60%" h={8} style={{ marginBottom: 10 }}/>
          <Bone w="50%" h={28} radius={4}/>
        </div>
      ))}
    </div>
  )
}

// ── CARD SKELETON ─────────────────────────────────────────────
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 16 }}>
      <style>{pulse}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <Bone w="40%" h={16}/>
        <Bone w="60px" h={16}/>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} w={i === lines - 1 ? '60%' : '100%'} h={12} style={{ marginBottom: 8 }}/>
      ))}
    </div>
  )
}

// ── FULL PAGE SKELETON ────────────────────────────────────────
export function PageSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <style>{pulse}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Bone w={200} h={28} radius={4} style={{ marginBottom: 8 }}/>
          <Bone w={120} h={12}/>
        </div>
        <Bone w={120} h={38} radius={9}/>
      </div>
      <StatsSkeleton count={4}/>
      <TableSkeleton rows={8}/>
    </div>
  )
}

// ── SO CARD SKELETON ──────────────────────────────────────────
export function SOCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      <style>{pulse}</style>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#1A1A24', border: '1px solid rgba(255,255,255,.055)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <Bone w={80} h={10} style={{ marginBottom: 8 }}/>
              <Bone w="60%" h={16} style={{ marginBottom: 6 }}/>
              <Bone w="40%" h={12}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <Bone w={80} h={20} radius={100}/>
              <Bone w={60} h={18} radius={100}/>
            </div>
          </div>
          <Bone w="80%" h={12}/>
        </div>
      ))}
    </>
  )
}
