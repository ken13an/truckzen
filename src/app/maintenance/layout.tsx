'use client'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

const BREADCRUMB_MAP: Record<string, string> = {
  '/maintenance': 'Dashboard',
  '/maintenance/repairs': 'Road Repairs',
  '/maintenance/drivers': 'Drivers',
  '/maintenance/pm': 'PM Schedules',
  '/maintenance/inspections': 'Inspections',
  '/maintenance/fuel': 'Fuel',
  '/maintenance/vendors': 'Vendors',
  '/maintenance/parts': 'Parts',
  '/maintenance/purchase-orders': 'Purchase Orders',
  '/maintenance/expenses': 'Expenses',
  '/maintenance/equipment': 'Equipment',
  '/maintenance/meters': 'Meters',
  '/maintenance/reports': 'Reports',
  '/maintenance/issues': 'Issues',
  '/maintenance/faults': 'Faults',
  '/maintenance/recalls': 'Recalls',
  '/maintenance/service-reminders': 'Service Reminders',
  '/maintenance/vehicle-renewals': 'Vehicle Renewals',
  '/maintenance/contact-renewals': 'Contact Renewals',
  '/maintenance/service-programs': 'Service Programs',
  '/maintenance/shop-network': 'Shop Network',
  '/maintenance/places': 'Places',
  '/maintenance/documents': 'Documents',
  '/maintenance/warranties': 'Warranties',
  '/maintenance/map': 'Fleet Map',
  '/maintenance/activity': 'Activity Feed',
}

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Build breadcrumbs
  const crumbs: { label: string; href?: string }[] = [{ label: 'Maintenance', href: '/maintenance' }]
  if (pathname && pathname !== '/maintenance') {
    // Find matching base path
    const basePath = Object.keys(BREADCRUMB_MAP).find(p => p !== '/maintenance' && pathname.startsWith(p))
    if (basePath) {
      crumbs.push({ label: BREADCRUMB_MAP[basePath], href: basePath })
      // Sub-pages like /new or /[id]
      const rest = pathname.slice(basePath.length)
      if (rest.includes('/new')) crumbs.push({ label: 'New' })
      else if (rest.match(/^\/[^/]+$/) && rest !== '/new') crumbs.push({ label: 'Detail' })
    }
  }

  const isRoot = pathname === '/maintenance'

  return (
    <div style={{ minHeight: '100vh', background: '#060708' }}>
      {!isRoot && crumbs.length > 1 && (
        <div style={{ padding: '12px 24px 0', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Instrument Sans',sans-serif" }}>
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <ChevronRight size={12} color="#48536A" />}
              {c.href && i < crumbs.length - 1 ? (
                <a href={c.href} style={{ color: '#4D9EFF', fontSize: 12, textDecoration: 'none' }}>{c.label}</a>
              ) : (
                <span style={{ color: '#7C8BA0', fontSize: 12 }}>{c.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
