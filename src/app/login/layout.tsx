import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to TruckZen — truck repair shop management software. Access service orders, invoices, parts inventory, and fleet tracking.',
  openGraph: {
    title: 'Log In — TruckZen',
    description: 'Access your truck shop management dashboard.',
    url: 'https://truckzen.pro/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
