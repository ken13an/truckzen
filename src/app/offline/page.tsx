'use client'
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-5">
      <div className="max-w-md text-center">
        <WifiOff size={48} strokeWidth={1.5} className="text-text-tertiary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-text-primary mb-2">You are offline</h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          TruckZen needs an internet connection to sync with the shop database. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-teal text-bg rounded-md text-sm font-bold hover:bg-teal-hover transition-colors duration-150">
          Retry
        </button>
      </div>
    </div>
  )
}
