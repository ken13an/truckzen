'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export function useKeyboardShortcuts() {
  const router = useRouter()
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'n') { e.preventDefault(); router.push('/orders/new') }
      if (k === 'g') { e.preventDefault(); router.push('/floor') }
      if (k === 'd') { e.preventDefault(); router.push('/dashboard') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])
}
