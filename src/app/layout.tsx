import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/Toast'
import AppShell from '@/components/AppShell'
import { ServiceWorkerRegistrar, InstallPrompt } from '@/components/ServiceWorker'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1D6FE8',
}

export const metadata: Metadata = {
  title: {
    default: 'TruckZen — Your Shop. Powered.',
    template: '%s — TruckZen',
  },
  description: 'The complete truck shop management platform.',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TruckZen',
  },
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
      { url: '/icon-152.png', sizes: '152x152' },
      { url: '/icon-167.png', sizes: '167x167' },
    ],
  },
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
        {/* Apple splash screens */}
        <link rel="apple-touch-startup-image" href="/splash-1170x2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"/>
        <link rel="apple-touch-startup-image" href="/splash-1284x2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"/>
        <link rel="apple-touch-startup-image" href="/splash-1290x2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"/>
      </head>
      <body style={{ margin: 0, padding: 0, background: '#060708', fontFamily: "'Instrument Sans',sans-serif" }}>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
        <ServiceWorkerRegistrar/>
        <InstallPrompt/>
      </body>
    </html>
  )
}
