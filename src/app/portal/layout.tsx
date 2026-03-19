import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Portal',
  description: 'TruckZen customer portal — view repair status, invoices, and service history for your fleet.',
  openGraph: {
    title: 'Customer Portal — TruckZen',
    description: 'View repair status and invoices for your fleet.',
    url: 'https://truckzen.pro/portal',
  },
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children
}
