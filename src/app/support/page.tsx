export default function SupportPage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh', color: '#111' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        <header style={{ marginBottom: 40 }}>
          <a href="https://truckzen.pro" style={{ textDecoration: 'none', color: '#111' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TruckZen</h1>
          </a>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '24px 0 8px' }}>Support</h2>
        </header>

        <section style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: '#333' }}>
            For help with TruckZen, contact our support team. We typically respond within one business day.
          </p>
        </section>

        <section style={{ marginBottom: 32, padding: '24px', background: '#f9fafb', borderRadius: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Contact</h3>
          <p style={{ fontSize: 15, lineHeight: 1.8, margin: 0 }}>
            Email: <a href="mailto:support@truckzen.pro" style={{ color: '#2563eb', fontWeight: 600 }}>support@truckzen.pro</a>
          </p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Helpful Links</h3>
          <ul style={{ paddingLeft: 20, lineHeight: 2.2, fontSize: 15 }}>
            <li><a href="/privacy" style={{ color: '#2563eb', textDecoration: 'none' }}>Privacy Policy</a></li>
            <li><a href="/terms" style={{ color: '#2563eb', textDecoration: 'none' }}>Terms of Service</a></li>
            <li><a href="https://truckzen.pro" style={{ color: '#2563eb', textDecoration: 'none' }}>TruckZen Homepage</a></li>
          </ul>
        </section>

        <footer style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, fontSize: 13, color: '#999' }}>
          2026 TruckZen
        </footer>
      </div>
    </div>
  )
}
