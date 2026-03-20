'use client'

export default function OfflinePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#060708', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Instrument Sans',sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>📡</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F4FF', marginBottom: 8 }}>You're offline</div>
        <div style={{ fontSize: 14, color: '#7C8BA0', lineHeight: 1.6, marginBottom: 24 }}>
          TruckZen needs an internet connection to sync with the shop database. Check your connection and try again.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '12px 28px', background: 'linear-gradient(135deg,#1D6FE8,#1248B0)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}
