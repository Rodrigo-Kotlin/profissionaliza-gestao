import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-navy text-white hover:bg-navy/90',
        gold: 'bg-gold text-navy hover:bg-gold/85',
        secondary: 'border border-navy/20 bg-white text-navy hover:bg-navy-50',
        ghost: 'text-muted hover:bg-navy-50 hover:text-navy',
        danger: 'bg-red-600 text-white hover:bg-red-700'
      },
      size: { sm: 'min-h-9 px-3 text-xs', md: 'min-h-10', lg: 'min-h-12 px-5' }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
export const Input = React.forwardRef<HTMLInputElement, FieldProps>(function Input(
  { className, label, error, id, ...props },
  ref
) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className="block text-sm font-medium text-ink">{label}</label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn('min-h-11 w-full rounded-lg border bg-white px-3 text-sm placeholder:text-slate-400 focus:border-navy', error && 'border-red-500', className)}
        {...props}
      />
      {error && <p id={`${inputId}-error`} className="text-xs text-red-600">{error}</p>}
    </div>
  )
})

export function SearchInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
      <input className="min-h-11 w-full rounded-lg border bg-navy-50 pl-10 pr-14 text-sm focus:border-navy" type="search" {...props} />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-white px-1.5 py-0.5 text-[10px] text-muted sm:block">Ctrl K</kbd>
    </div>
  )
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('min-h-24 w-full resize-y rounded-lg border bg-white p-3 text-sm focus:border-navy', className)} {...props} />
})

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn('min-h-11 rounded-lg border bg-white px-3 text-sm focus:border-navy', className)} {...props} />
})

export function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className="size-4 rounded border-slate-300 accent-navy" {...props} />
}
export function Radio(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="radio" className="size-4 accent-navy" {...props} />
}
export function Switch({ checked, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="checkbox" role="switch" checked={checked} onChange={onChange} className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-slate-300 p-0.5 transition checked:bg-navy before:block before:size-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4" {...props} />
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border bg-white shadow-ambient', className)} {...props} />
}

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', {
  variants: { variant: {
    neutral: 'bg-slate-100 text-slate-700', success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800', danger: 'bg-red-100 text-red-800', info: 'bg-blue-100 text-blue-800'
  } }, defaultVariants: { variant: 'neutral' }
})
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return <div className={cn('grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border bg-navy-50 text-xs font-semibold text-navy', className)}>{src ? <img src={src} alt="" className="size-full object-cover" /> : name.split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase()}</div>
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-slate-200', className)} />
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return <div role="progressbar" aria-valuenow={value} className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)}><div className="h-full rounded-full bg-navy transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
}

export function Tabs({ items, value, onChange }: { items: string[]; value: string; onChange: (value: string) => void }) {
  return <div role="tablist" className="flex overflow-x-auto rounded-lg border bg-navy-50 p-1">{items.map((item) => <button role="tab" aria-selected={item === value} key={item} onClick={() => onChange(item)} className={cn('min-h-10 whitespace-nowrap rounded-md px-4 text-xs font-semibold text-muted', item === value && 'bg-white text-navy shadow-ambient')}>{item}</button>)}</div>
}

export function AlertCard({ title, children, variant = 'info' }: { title: string; children: React.ReactNode; variant?: 'info' | 'warning' | 'danger' }) {
  return <Card className={cn('p-4', variant === 'danger' && 'border-red-200 bg-red-50', variant === 'warning' && 'border-amber-200 bg-amber-50')}><h3 className="mb-1 text-base font-semibold">{title}</h3><div className="text-sm text-muted">{children}</div></Card>
}

export function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return <div className="grid min-h-48 place-items-center p-6 text-center"><div><Icon className="mx-auto mb-3 size-8 text-slate-400" /><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{description}</p></div></div>
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><h1 className="text-[28px] font-bold leading-9 tracking-tight md:text-[32px] md:leading-10">{title}</h1>{description && <p className="mt-1.5 text-sm text-muted md:text-base">{description}</p>}</div>{children}</header>
}

export function FilterBar({ children }: { children: React.ReactNode }) { return <Card className="flex flex-wrap items-center gap-3 p-4">{children}</Card> }
export function Breadcrumb({ items }: { items: string[] }) { return <nav aria-label="Navegação estrutural" className="flex gap-2 text-xs font-semibold uppercase tracking-wider text-muted">{items.map((item, i) => <React.Fragment key={item}><span>{item}</span>{i < items.length - 1 && <span>/</span>}</React.Fragment>)}</nav> }
export function Pagination({ page = 1 }: { page?: number }) { return <nav aria-label="Paginação" className="flex items-center gap-1"><Button variant="ghost" size="sm" disabled={page === 1}>Anterior</Button><Button size="sm">{page}</Button><Button variant="ghost" size="sm">Próxima</Button></nav> }
export function CloseButton({ onClick }: { onClick?: () => void }) { return <Button aria-label="Fechar" variant="ghost" size="sm" onClick={onClick}><X className="size-4" /></Button> }
