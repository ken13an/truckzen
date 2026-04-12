/**
 * TruckZen — Public API Documentation
 */
'use client'
import { useTheme } from '@/hooks/useTheme'

const FONT = "'Instrument Sans',sans-serif"
const MONO = "'IBM Plex Mono',monospace"

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/work-orders', params: 'from_date, to_date, status, page, limit', desc: 'List work orders with job lines, parts, customer/unit info' },
  { method: 'GET', path: '/api/v1/invoices', params: 'status, page, limit', desc: 'List invoices with totals and payment status' },
  { method: 'GET', path: '/api/v1/customers', params: 'search, page, limit', desc: 'List customers with contact info, DOT/MC numbers' },
  { method: 'GET', path: '/api/v1/units', params: 'customer_id, status, search, page, limit', desc: 'List trucks/trailers with VIN, odometer, warranty info' },
  { method: 'GET', path: '/api/v1/parts', params: 'search, page, limit', desc: 'Parts catalog with pricing and stock levels' },
  { method: 'GET', path: '/api/v1/technicians', params: 'page, limit', desc: 'Team members with roles and skills' },
]

export default function ApiDocsPage() {
  const { tokens: t } = useTheme()
  return (
    <div style={{ background: t.bg, minHeight: '100vh', color: t.text, fontFamily: FONT, padding: '48px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1D6FE8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8, fontFamily: MONO }}>API Reference</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: t.text, margin: '0 0 12px', lineHeight: 1.2 }}>TruckZen Public API v1</h1>
          <p style={{ fontSize: 16, color: t.textSecondary, lineHeight: 1.6, margin: 0 }}>Read-only API for integrating with TruckZen. Pull work orders, invoices, customers, units, and parts data from your shop.</p>
        </div>

        {/* Auth */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 12 }}>Authentication</h2>
          <p style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>All requests require a Bearer token in the Authorization header. Generate API keys in Settings → API.</p>
          <div style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 16, fontFamily: MONO, fontSize: 13, color: '#4D9EFF', overflowX: 'auto' }}>
            Authorization: Bearer tz_live_ugl_a8f3b2c1d4e5f6789012345678901234
          </div>
        </section>

        {/* Rate Limits */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 12 }}>Rate Limits</h2>
          <p style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>Default: 100 requests/hour per API key. Response headers include <code style={{ fontFamily: MONO, color: '#4D9EFF' }}>X-RateLimit-Limit</code> and <code style={{ fontFamily: MONO, color: '#4D9EFF' }}>X-RateLimit-Remaining</code>.</p>
        </section>

        {/* Endpoints */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 16 }}>Endpoints</h2>
          {ENDPOINTS.map(ep => (
            <div key={ep.path} style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,.1)', padding: '2px 8px', borderRadius: 4 }}>{ep.method}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: t.text }}>{ep.path}</span>
              </div>
              <p style={{ fontSize: 13, color: t.textSecondary, margin: '0 0 8px' }}>{ep.desc}</p>
              <div style={{ fontSize: 11, color: t.textTertiary, fontFamily: MONO }}>Params: {ep.params}</div>
            </div>
          ))}
        </section>

        {/* Response format */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 12 }}>Response Format</h2>
          <pre style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 16, fontFamily: MONO, fontSize: 12, color: t.text, overflowX: 'auto', lineHeight: 1.6 }}>{`{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 30818,
    "page": 1,
    "limit": 100,
    "totalPages": 309
  },
  "generated_at": "2026-03-22T20:00:00Z"
}`}</pre>
        </section>

        {/* Examples */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 12 }}>Examples</h2>

          <h3 style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>cURL</h3>
          <pre style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 16, fontFamily: MONO, fontSize: 12, color: t.text, overflowX: 'auto', marginBottom: 16 }}>{`curl -H "Authorization: Bearer tz_live_ugl_a8f3..." \\
  "https://truckzen.pro/api/v1/work-orders?from_date=2026-02-01&limit=25"`}</pre>

          <h3 style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>Python</h3>
          <pre style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 16, fontFamily: MONO, fontSize: 12, color: t.text, overflowX: 'auto', marginBottom: 16 }}>{`import requests

headers = {"Authorization": "Bearer tz_live_ugl_a8f3..."}
response = requests.get(
    "https://truckzen.pro/api/v1/customers",
    headers=headers,
    params={"limit": 50, "search": "UGL"}
)
data = response.json()
print(f"Found {data['pagination']['total']} customers")`}</pre>

          <h3 style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, marginBottom: 8 }}>JavaScript</h3>
          <pre style={{ background: t.bgCard, border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 16, fontFamily: MONO, fontSize: 12, color: t.text, overflowX: 'auto' }}>{`const res = await fetch("https://truckzen.pro/api/v1/units?limit=100", {
  headers: { "Authorization": "Bearer tz_live_ugl_a8f3..." }
});
const { data, pagination } = await res.json();
console.log(\`\${pagination.total} units\`);`}</pre>
        </section>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 24, color: t.textTertiary, fontSize: 12 }}>
          TruckZen API v1 — All endpoints are read-only. Data is isolated per shop.
        </div>
      </div>
    </div>
  )
}
