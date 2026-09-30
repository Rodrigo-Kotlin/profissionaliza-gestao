import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/lib/offline'

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" aria-live="polite" className="app-banner-top fixed inset-x-0 z-[65] flex items-center justify-center gap-2 bg-warning pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] py-2 text-sm font-semibold text-amber-950">
      <WifiOff className="size-4" />
      Você está sem conexão.
    </div>
  )
}
