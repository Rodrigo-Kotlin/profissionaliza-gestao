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
  const [selected, setSelected] = useState(0)
  useEffect(() => { if (!open) { setQuery(''); setSelected(0) } }, [open])
  const filtered = results.filter((item) => `${item.type} ${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase()))
  useEffect(() => setSelected(0), [query])
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(value + 1, filtered.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)) }
    if (event.key === 'Enter' && filtered[selected]) { onOpenChange(false) }
  }
  return <Modal open={open} onOpenChange={onOpenChange} title="Busca global"><div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} role="combobox" aria-label="Buscar" aria-expanded="true" aria-controls="search-results" aria-activedescendant={filtered[selected] ? `search-${selected}` : undefined} placeholder="Buscar aluno, venda, contrato, turma..." className="min-h-11 w-full rounded-lg border pl-10 pr-10 text-sm" />{query && <button aria-label="Limpar busca" onClick={() => setQuery('')} className="absolute right-2 top-2 grid size-7 place-items-center"><X className="size-4" /></button>}</div><div id="search-results" role="listbox" className="mt-4 divide-y">{filtered.map(({ icon: Icon, ...item }, index) => <button key={`${item.type}-${item.label}`} id={`search-${index}`} role="option" aria-selected={index === selected} onClick={() => onOpenChange(false)} onMouseEnter={() => setSelected(index)} className={`flex min-h-16 w-full items-center gap-3 rounded-lg px-2 text-left ${index === selected ? 'bg-navy-50' : ''}`}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.label}</span><span className="block truncate text-xs text-muted">{item.type} · {item.detail}</span></span></button>)}{filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">Nenhum resultado encontrado.</p>}</div><p className="mt-4 border-t pt-3 text-xs text-muted">Dados demonstrativos. A busca já está isolada para futura integração com os módulos. Use ↑ ↓ para navegar e Enter para selecionar.</p></Modal>
}
