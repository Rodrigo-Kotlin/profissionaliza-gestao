import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseButton } from './core'

export function Modal({ trigger, title, children, open, onOpenChange }: { trigger?: ReactNode; title: string; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-navy/50 backdrop-blur-sm" /><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border bg-white p-6 shadow-floating"><div className="mb-5 flex items-center justify-between"><DialogPrimitive.Title className="text-xl font-semibold">{title}</DialogPrimitive.Title><DialogPrimitive.Close asChild><CloseButton /></DialogPrimitive.Close></div>{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
}

export function Drawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-navy/60" /><DialogPrimitive.Content className="fixed inset-y-0 left-0 z-[71] w-[min(90vw,320px)] bg-navy shadow-floating"><DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>{children}</DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
}

export function DropdownMenu({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return <DropdownPrimitive.Root><DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger><DropdownPrimitive.Portal><DropdownPrimitive.Content align={align} sideOffset={8} className="z-[80] min-w-48 rounded-xl border bg-white p-1.5 shadow-floating">{children}</DropdownPrimitive.Content></DropdownPrimitive.Portal></DropdownPrimitive.Root>
}
export function DropdownItem({ children, onSelect, danger }: { children: ReactNode; onSelect?: () => void; danger?: boolean }) { return <DropdownPrimitive.Item onSelect={onSelect} className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none hover:bg-navy-50 focus:bg-navy-50', danger && 'text-red-600')}>{children}</DropdownPrimitive.Item> }

export function Tooltip({ children, content }: { children: ReactNode; content: string }) {
  return <TooltipPrimitive.Provider delayDuration={300}><TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={6} className="z-[90] rounded-md bg-navy px-2 py-1 text-xs text-white shadow-floating">{content}</TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root></TooltipPrimitive.Provider>
}
