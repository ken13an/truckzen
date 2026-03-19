import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/kiosk', '/portal'],
        disallow: ['/api/', '/dashboard', '/orders', '/invoices', '/parts', '/fleet', '/settings', '/admin', '/tech', '/accounting'],
      },
    ],
    sitemap: 'https://truckzen.pro/sitemap.xml',
  }
}
