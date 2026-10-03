import { CalendarDays, GraduationCap, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { updateSearchParams } from '@/lib/url-params'
import { computeTotalPages, useNormalizedPage } from '@/lib/pagination'
import { useCrmCourses } from '../crm/crm-hooks'
import { useEnrollmentList } from './enrollments-hooks'
import { ENROLLMENT_PAGE_SIZE, ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_TONES, ENROLLMENT_STATUSES } from './enrollment-constants'
import { formatEnrollmentDate, parseEnrollmentListParams } from './enrollment-utils'
import { EnrollmentStatusBadge } from './enrollment-status-badge'
import type { EnrollmentListItem } from './enrollment-types'

export function EnrollmentsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const parsed = useMemo(() => parseEnrollmentListParams(params), [params])
  const [searchQuery, setSearchQuery] = useState(parsed.q ?? '')
  useEffect(() => setSearchQuery(parsed.q ?? ''), [parsed.q])
  const updateParams = (next: Record<string, string | number | undefined | null>) => setParams(updateSearchParams(params, next), { replace: true })
  const courses = useCrmCourses('ACTIVE')
  const query = useEnrollmentList({ q: parsed.q, status: parsed.status, course_id: parsed.course_id, date_from: parsed.date_from, date_to: parsed.date_to, page: parsed.page, page_size: ENROLLMENT_PAGE_SIZE })
  const rows = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const totalPages = computeTotalPages(total, ENROLLMENT_PAGE_SIZE)
  useNormalizedPage(total, parsed.page, totalPages, (page) => updateParams({ page }))

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Matrículas" description="Acompanhe a jornada acadêmica dos alunos por curso." />
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
          <Input aria-label="Buscar matrículas" placeholder="Código, aluno ou venda..." className="pl-9" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); updateParams({ q: event.target.value || undefined }) }} />
          {searchQuery && <Button type="button" variant="ghost" aria-label="Limpar busca" className="absolute right-1 top-0 grid size-11 place-items-center px-0" onClick={() => { setSearchQuery(''); updateParams({ q: undefined }) }}><X className="size-4" /></Button>}
        </div>
        <Select aria-label="Filtrar status" value={parsed.status ?? ''} onChange={(event) => updateParams({ status: event.target.value || undefined })}>
          <option value="">Todos os status</option>
          {ENROLLMENT_STATUSES.map((status) => <option key={status} value={status}>{ENROLLMENT_STATUS_LABELS[status]}</option>)}
        </Select>
        <Select aria-label="Filtrar curso" value={parsed.course_id ?? ''} onChange={(event) => updateParams({ course: event.target.value || undefined })}>
          <option value="">Todos os cursos</option>
          {courses.data?.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
        </Select>
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
          <CalendarDays className="size-4 text-muted" />
          <Input type="date" aria-label="Data inicial" value={parsed.date_from ?? ''} onChange={(event) => updateParams({ date_from: event.target.value || undefined })} className="min-w-0 sm:w-[145px]" />
          <span className="text-sm text-muted">até</span>
          <Input type="date" aria-label="Data final" value={parsed.date_to ?? ''} onChange={(event) => updateParams({ date_to: event.target.value || undefined })} className="min-w-0 sm:w-[145px]" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {query.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16" />)}</div>
          : query.isError ? <EmptyState icon={GraduationCap} title="Erro ao carregar matrículas" description="Tente novamente mais tarde." />
            : !rows.length ? <EmptyState icon={GraduationCap} title="Nenhuma matrícula encontrada" description={parsed.q ? 'Tente outro termo de busca.' : 'As matrículas aparecerão após contratos assinados.'} />
              : <>
                <DataTable data={rows} getKey={(row) => row.enrollment_id} mobileCard={(row) => <EnrollmentMobileRow row={row} />} columns={[
                  { key: 'code', header: 'Código', cell: (row) => <button className="font-mono text-xs font-semibold text-navy hover:underline" onClick={() => navigate(`/matriculas/${row.enrollment_id}`)}>{row.enrollment_code}</button> },
                  { key: 'student', header: 'Aluno', cell: (row) => <button className="text-left text-sm font-semibold text-navy hover:underline" onClick={() => navigate(`/matriculas/${row.enrollment_id}`)}>{row.student_name}</button> },
                  { key: 'course', header: 'Curso', priority: 'medium', cell: (row) => <span className="text-muted">{row.course_name}</span> },
                  { key: 'status', header: 'Status', cell: (row) => <EnrollmentStatusBadge status={row.status} /> },
                  { key: 'date', header: 'Data', priority: 'medium', cell: (row) => <span className="text-muted">{formatEnrollmentDate(row.enrollment_date)}</span> },
                  { key: 'contract', header: 'Contrato', priority: 'low', cell: (row) => <span className="font-mono text-xs text-muted">{row.contract_code}</span> },
                  { key: 'sale', header: 'Venda', priority: 'low', cell: (row) => <span className="font-mono text-xs text-muted">{row.sale_code}</span> }
                ]} />
                {totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 p-4"><span className="text-xs text-muted">{total} matrícula{total !== 1 ? 's' : ''} · Página {parsed.page} de {totalPages}</span><div className="flex gap-2"><Button variant="ghost" disabled={parsed.page <= 1} onClick={() => updateParams({ page: parsed.page - 1 })}>Anterior</Button><Button variant="ghost" disabled={parsed.page >= totalPages} onClick={() => updateParams({ page: parsed.page + 1 })}>Próxima</Button></div></div>}
              </>}
      </Card>
    </div>
  )
}

function EnrollmentMobileRow({ row }: { row: EnrollmentListItem }) {
  const navigate = useNavigate()
  return <div className="min-w-0 space-y-2"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0 max-w-full"><button className="block max-w-full break-words font-mono text-xs font-semibold text-navy" onClick={() => navigate(`/matriculas/${row.enrollment_id}`)}>{row.enrollment_code}</button><p className="break-words text-sm font-semibold">{row.student_name}</p></div><Badge className="shrink-0" variant={ENROLLMENT_STATUS_TONES[row.status]}>{ENROLLMENT_STATUS_LABELS[row.status]}</Badge></div><p className="break-words text-sm text-muted">{row.course_name}</p><p className="break-words text-xs text-muted">{formatEnrollmentDate(row.enrollment_date)} · {row.contract_code}</p><Button variant="ghost" className="h-11 px-2" onClick={() => navigate(`/matriculas/${row.enrollment_id}`)}>Ver matrícula</Button></div>
}
