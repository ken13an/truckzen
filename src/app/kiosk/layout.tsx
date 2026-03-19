import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Customer Kiosk Check-In',
  description: 'Self-service truck check-in kiosk for TruckZen repair shops. Drop off your truck and get real-time status updates.',
  openGraph: {
    title: 'Customer Kiosk — TruckZen',
    description: 'Self-service truck check-in for repair shops.',
    url: 'https://truckzen.pro/kiosk',
  },
}

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return children
}
