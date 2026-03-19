import type { Metadata } from 'next'
import { FileQuestion } from 'lucide-react'

export const metadata: Metadata = { title: 'Page Not Found', robots: { index: false, follow: false } }

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className="max-w-md text-center">
        <FileQuestion size={48} strokeWidth={1.5} className="text-text-tertiary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary mb-2">Page not found</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          The page you are looking for does not exist or you do not have access.
        </p>
        <a href="/dashboard" className="inline-block px-6 py-2.5 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150 no-underline">
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
