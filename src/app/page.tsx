import type { Metadata } from 'next'
import TruckZenLandingClient from '@/components/landing/TruckZenLandingClient'

export const metadata: Metadata = {
  title: 'TruckZen — Truck Repair Shop & Fleet Operations Platform',
  description: 'TruckZen is the platform for truck repair shops and fleet operations: work orders, parts, invoices, shop floor, and maintenance in one system.',
  alternates: { canonical: 'https://truckzen.pro' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'TruckZen — Truck Repair Shop & Fleet Operations Platform',
    description: 'One platform. Every department. Every language.',
    url: 'https://truckzen.pro',
    type: 'website',
    siteName: 'TruckZen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruckZen — Truck Repair Shop & Fleet Operations Platform',
    description: 'One platform. Every department. Every language.',
  },
}

export default function HomePage() {
  return <TruckZenLandingClient />
}
