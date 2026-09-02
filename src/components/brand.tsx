import { cn } from '@/lib/utils'

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold text-lg font-bold text-navy shadow-ambient">
        P
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className={cn('font-display text-xl font-bold', light ? 'text-gold-light' : 'text-navy')}>
            Profissionaliza
          </div>
          <div className={cn('text-xs font-semibold uppercase tracking-[.08em]', light ? 'text-white/55' : 'text-muted')}>
            Gestão Educacional
          </div>
        </div>
      )}
    </div>
  )
}
