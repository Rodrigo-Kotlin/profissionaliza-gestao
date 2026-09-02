import { GraduationCap, LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/overlays'
import { studentsService } from '@/features/students/students-service'
import type { StudentListResponse } from '@/features/students/students-types'

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [students, setStudents] = useState<StudentListResponse['data']>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqRef = useRef(0)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelected(0)
      setStudents([])
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
      setStudents([])
      setSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const result = await studentsService.searchLight(term)
        if (current === reqRef.current) {
          setStudents(result.data)
          setSearched(true)
        }
      } catch {
        if (current === reqRef.current) setStudents([])
      } finally {
        if (current === reqRef.current) setLoading(false)
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const go = (item: (typeof students)[number]) => {
    onOpenChange(false)
    navigate(`/alunos/${item.student_id}`)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(value + 1, students.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)) }
    if (event.key === 'Enter' && students[selected]) { go(students[selected]) }
  }

  const hasResults = students.length > 0

  return <Modal open={open} onOpenChange={onOpenChange} title="Busca global"><div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} role="combobox" aria-label="Buscar" aria-expanded="true" aria-controls="search-results" aria-activedescendant={students[selected] ? `search-${selected}` : undefined} placeholder="Buscar aluno por nome ou código..." className="min-h-11 w-full rounded-lg border pl-10 pr-10 text-sm" />{loading ? <LoaderCircle className="absolute right-2 top-3 size-4 animate-spin text-muted" /> : query ? <button aria-label="Limpar busca" onClick={() => setQuery('')} className="absolute right-2 top-2 grid size-7 place-items-center"><X className="size-4" /></button> : null}</div><div id="search-results" role="listbox" className="mt-4 divide-y">{!query ? <p className="py-8 text-center text-sm text-muted">Digite para buscar alunos.</p> : loading ? <p className="py-8 text-center text-sm text-muted">Buscando...</p> : hasResults ? students.map((item, index) => <button key={item.student_id} id={`search-${index}`} role="option" aria-selected={index === selected} onClick={() => go(item)} onMouseEnter={() => setSelected(index)} className={`flex min-h-16 w-full items-center gap-3 rounded-lg px-2 text-left ${index === selected ? 'bg-navy-50' : ''}`}><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy"><GraduationCap className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.full_name}</span><span className="block truncate text-xs text-muted">Aluno · {item.student_code}</span></span></button>) : <p className="py-8 text-center text-sm text-muted">Nenhum aluno encontrado.</p>}</div><p className="mt-4 border-t pt-3 text-xs text-muted">{searched && !hasResults ? 'Dados protegidos por LGPD são exibidos de forma reduzida conforme a permissão.' : 'Use ↑ ↓ para navegar e Enter para selecionar.'}</p></Modal>
}