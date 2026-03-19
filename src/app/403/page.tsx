import type { Metadata } from 'next'
import { ShieldX } from 'lucide-react'

export const metadata: Metadata = { title: 'Access Denied', robots: { index: false, follow: false } }

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className="max-w-md text-center">
        <ShieldX size={48} strokeWidth={1.5} className="text-error mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary mb-2">Access Denied</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          You do not have permission to access this page. Contact your shop manager or IT admin if you need access.
        </p>
        <a href="/dashboard" className="inline-block px-6 py-2.5 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
