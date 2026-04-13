import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/Toast'
import AppShell from '@/components/AppShell'
import { ServiceWorkerRegistrar, InstallPrompt } from '@/components/ServiceWorker'
import { ThemeProvider } from '@/lib/providers/ThemeProvider'
import { THEME } from '@/lib/config/colors'

const SITE_URL = 'https://truckzen.pro'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: THEME.dark.accent,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'TruckZen — Truck Repair Shop Management Software',
    template: '%s — TruckZen',
  },
  description: 'Complete truck shop management platform. Service orders, invoicing, parts inventory, fleet tracking, tire lifecycle, DVIR, PM scheduling, and AI-powered service writing — built for heavy-duty repair shops.',
  keywords: ['truck repair shop software', 'truck shop management', 'fleet maintenance software', 'service order management', 'heavy duty repair', 'truck invoicing', 'parts inventory', 'tire tracker', 'DVIR software', 'PM scheduling', 'truck fleet management', 'shop floor management'],
  authors: [{ name: 'TruckZen' }],
  creator: 'TruckZen',
  publisher: 'TruckZen',
  manifest: '/manifest.json',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'TruckZen',
    title: 'TruckZen — Truck Repair Shop Management Software',
    description: 'Complete truck shop management platform. Service orders, invoicing, parts inventory, fleet tracking, tire lifecycle, and AI-powered service writing.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TruckZen — Your Shop. Powered.',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruckZen — Truck Repair Shop Management Software',
    description: 'Complete truck shop management platform for heavy-duty repair shops.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
        {/* Pre-hydration theme script — sets data-tz-mode and a full set of
            CSS variables on <html> so the shell can paint correctly
            regardless of any React hydration timing issues. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var T=${JSON.stringify({ light: THEME.light, dark: THEME.dark })};var m=localStorage.getItem('tz-theme-mode');if(m!=='light'&&m!=='dark')m='dark';document.documentElement.setAttribute('data-tz-mode',m);var t=T[m];var vars='';for(var k in t){vars+='--tz-'+k+':'+t[k]+';'}var s=document.createElement('style');s.setAttribute('data-tz-boot','1');s.appendChild(document.createTextNode(':root{'+vars+'}html,html body{background:var(--tz-bg);color:var(--tz-text)}'));document.head.appendChild(s);}catch(e){}})();`,
          }}
        />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'TruckZen',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web, iOS, Android',
              url: SITE_URL,
              description: 'Complete truck shop management platform. Service orders, invoicing, parts inventory, fleet tracking, tire lifecycle, DVIR, PM scheduling, and AI-powered service writing — built for heavy-duty repair shops.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: 'Contact for pricing',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.9',
                ratingCount: '47',
              },
              featureList: [
                'Service Order Management',
                'Invoicing & Payments',
                'Parts Inventory Tracking',
                'Fleet & Asset Management',
                'Tire Lifecycle Tracker',
                'Preventive Maintenance Scheduling',
                'DVIR Submissions',
                'AI-Powered Service Writer',
                'Telegram Bot Integration',
                'QuickBooks Sync',
                'Customer Kiosk Check-in',
                'QR Code Payments',
                'Role-Based Access Control',
                'Multilingual Support',
              ],
              screenshot: `${SITE_URL}/og-image.png`,
            }),
          }}
        />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, fontFamily: "'Instrument Sans',sans-serif" }}>
        <ThemeProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
          <ServiceWorkerRegistrar/>
          <InstallPrompt/>
        </ThemeProvider>
      </body>
    </html>
  )
}
