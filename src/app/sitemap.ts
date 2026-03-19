import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://truckzen.pro'
  const now = new Date().toISOString()

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/kiosk`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/portal`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/forgot-password`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/reset-password`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
