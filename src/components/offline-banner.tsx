import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  if (online) return null
  return (
    <div role="status" aria-live="polite" className="safe-top fixed inset-x-0 top-16 z-[65] flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-semibold text-amber-950">
      <WifiOff className="size-4" />
      Você está sem conexão.
    </div>
  )
}
