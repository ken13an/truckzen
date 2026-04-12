import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log In — TruckZen',
  description: 'Log in to your TruckZen account.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: 'Log In — TruckZen',
    description: 'Access your TruckZen dashboard.',
    url: 'https://truckzen.pro/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
