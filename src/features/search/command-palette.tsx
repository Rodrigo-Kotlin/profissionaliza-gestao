import { GraduationCap, LoaderCircle, Search, UserRoundSearch, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/overlays'
import { studentsService } from '@/features/students/students-service'
import { crmService } from '@/features/crm/crm-service'
import type { StudentListResponse } from '@/features/students/students-types'

type SearchResult =
  | { kind: 'student'; id: string; name: string; code: string }
  | { kind: 'lead'; id: string; name: string; code: string; course: string | null }

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqRef = useRef(0)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelected(0)
      setResults([])
      setSearched(false)
      setLoading(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
    const term = query.trim()
    reqRef.current += 1
    const current = reqRef.current

    if (timerRef.current) clearTimeout(timerRef.current)
    if (!term) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const [studentsResult, leadsResult] = await Promise.allSettled([
          studentsService.searchLight(term),
          crmService.searchLeadsLight(term)
        ])

        if (current !== reqRef.current) return

        const combined: SearchResult[] = []

        if (studentsResult.status === 'fulfilled') {
          const studentItems: StudentListResponse['data'] = studentsResult.value.data
          for (const s of studentItems) {
            combined.push({ kind: 'student', id: s.student_id, name: s.full_name, code: s.student_code })
          }
        }

        if (leadsResult.status === 'fulfilled') {
          for (const l of leadsResult.value) {
            combined.push({ kind: 'lead', id: l.id, name: l.full_name, code: l.lead_code, course: l.course_name })
          }
        }

        setResults(combined)
        setSearched(true)
      } catch {
        if (current === reqRef.current) setResults([])
      } finally {
        if (current === reqRef.current) setLoading(false)
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const go = (item: SearchResult) => {
    onOpenChange(false)
    if (item.kind === 'student') {
      navigate(`/alunos/${item.id}`)
    } else {
      navigate(`/crm/leads/${item.id}`)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(value + 1, results.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)) }
    if (event.key === 'Enter' && results[selected]) { go(results[selected]) }
  }

  const hasResults = results.length > 0

  return <Modal open={open} onOpenChange={onOpenChange} title="Busca global"><div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} role="combobox" aria-label="Buscar" aria-expanded="true" aria-controls="search-results" aria-activedescendant={results[selected] ? `search-${selected}` : undefined} placeholder="Buscar aluno, lead, venda..." className="min-h-11 w-full rounded-lg border pl-10 pr-10 text-sm" />{loading ? <LoaderCircle className="absolute right-2 top-3 size-4 animate-spin text-muted" /> : query ? <button aria-label="Limpar busca" onClick={() => setQuery('')} className="absolute right-2 top-2 grid size-7 place-items-center"><X className="size-4" /></button> : null}</div><div id="search-results" role="listbox" className="mt-4 divide-y">{!query ? <p className="py-8 text-center text-sm text-muted">Digite para buscar alunos e leads.</p> : loading ? <p className="py-8 text-center text-sm text-muted">Buscando...</p> : hasResults ? results.map((item, index) => <button key={`${item.kind}-${item.id}`} id={`search-${index}`} role="option" aria-selected={index === selected} onClick={() => go(item)} onMouseEnter={() => setSelected(index)} className={`flex min-h-16 w-full items-center gap-3 rounded-lg px-2 text-left ${index === selected ? 'bg-navy-50' : ''}`}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy">{item.kind === 'student' ? <GraduationCap className="size-4" /> : <UserRoundSearch className="size-4" />}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block truncate text-xs text-muted">{item.kind === 'student' ? `Aluno · ${item.code}` : `Lead · ${item.code}${item.course ? ` · ${item.course}` : ''}`}</span></span></button>) : <p className="py-8 text-center text-sm text-muted">Nenhum resultado encontrado.</p>}</div><p className="mt-4 border-t pt-3 text-xs text-muted">{searched && !hasResults ? 'Dados protegidos por LGPD são exibidos de forma reduzida conforme a permissão.' : 'Use ↑↓ para navegar, Enter para selecionar, Esc para fechar.'}</p></Modal>
}
