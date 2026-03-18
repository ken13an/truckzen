import type { Metadata } from 'next'
import { ToastProvider } from '@/components/Toast'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: {
    default: 'TruckZen — Your Shop. Powered.',
    template: '%s — TruckZen',
  },
  description: 'The complete truck shop management platform.',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  themeColor: '#060708',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#060708', fontFamily: "'Instrument Sans',sans-serif" }}>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  )
}
