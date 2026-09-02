import { FileText, GraduationCap, Search, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/overlays'

const results = [
  { type: 'Aluno', label: 'Mariana Costa', detail: 'Matrícula 2024-0182', icon: GraduationCap },
  { type: 'Lead', label: 'Lucas Martins', detail: 'Curso de Administração', icon: Users },
  { type: 'Contrato', label: 'CT-2026-0042', detail: 'Ana Beatriz Marques', icon: FileText }
]
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const [query, setQuery] = useState('')
  useEffect(() => { if (!open) setQuery('') }, [open])
  const filtered = results.filter((item) => `${item.type} ${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()))
  return <Modal open={open} onOpenChange={onOpenChange} title="Busca global"><div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno, venda, contrato, turma..." className="min-h-11 w-full rounded-lg border pl-10 pr-10 text-sm" />{query && <button aria-label="Limpar busca" onClick={() => setQuery('')} className="absolute right-2 top-2 grid size-7 place-items-center"><X className="size-4" /></button>}</div><div className="mt-4 divide-y">{filtered.map(({ icon: Icon, ...item }) => <button key={`${item.type}-${item.label}`} className="flex min-h-16 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-navy-50"><span className="grid size-9 place-items-center rounded-lg bg-navy-50 text-navy"><Icon className="size-4" /></span><span><span className="block text-sm font-semibold">{item.label}</span><span className="block text-xs text-muted">{item.type} · {item.detail}</span></span></button>)}{filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">Nenhum resultado encontrado.</p>}</div><p className="mt-4 border-t pt-3 text-xs text-muted">Dados demonstrativos. A busca já está isolada para futura integração com os módulos.</p></Modal>
}
