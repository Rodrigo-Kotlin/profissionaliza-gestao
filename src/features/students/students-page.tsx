import { GraduationCap, Plus, Search, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { can, PERMISSIONS, STUDENT_ORIGINS, STUDENT_ORIGIN_LABELS, STUDENT_STATUS_LABELS } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'
import { useStudents } from './students-hooks'
import { parseStudentListParams, STATUS_TONE } from './students-utils'
import type { StudentListItem, StudentSort, SortDirection } from './students-types'

const PAGE_SIZES = [20, 50, 100]

export function StudentsPage() {
  const { permissions } = useAuth()
  const canCreate = can(permissions, PERMISSIONS.STUDENTS_CREATE)
  const canEdit = can(permissions, PERMISSIONS.STUDENTS_EDIT)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const parsed = useMemo<{
    query?: string
    status?: string
    origin?: string
    page: number
    pageSize: number
    sort: StudentSort
    sortDir: SortDirection
  }>(() => {
    const raw = parseStudentListParams(params)
    return {
      query: raw.query,
      status: raw.status,
      origin: raw.origin,
      page: raw.page,
      pageSize: raw.pageSize,
      sort: raw.sort as StudentSort,
      sortDir: raw.sortDir
    }
  }, [params])
  const { data, isLoading, isError } = useStudents(parsed)

  const updateParams = (next: Record<string, string | undefined>) => {
    const copy = new URLSearchParams(params)
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === '') copy.delete(key)
      else copy.set(key, value)
    })
    setParams(copy, { replace: true })
  }

  const [mobileFilters, setMobileFilters] = useState(false)

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Alunos" description="Gerencie os cadastros e acompanhe os alunos da Profissionaliza.">
        {canCreate && (
          <Button onClick={() => navigate('/alunos/novo')}>
            <Plus className="size-4" /> Novo aluno
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
            <Input
              aria-label="Buscar aluno"
              placeholder="Nome, CPF, telefone ou código..."
              defaultValue={parsed.query ?? ''}
              onChange={(e) => updateParams({ q: e.target.value || undefined, page: undefined })}
              className="pl-10"
            />
          </div>
          <div className="hidden gap-2 lg:flex">
            <Select aria-label="Filtrar por status" value={parsed.status ?? ''} onChange={(e) => updateParams({ status: e.target.value || undefined, page: undefined })}>
              <option value="">Todos os status</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select aria-label="Filtrar por origem" value={parsed.origin ?? ''} onChange={(e) => updateParams({ origin: e.target.value || undefined, page: undefined })}>
              <option value="">Todas as origens</option>
              {STUDENT_ORIGINS.map((value) => (
                <option key={value} value={value}>{STUDENT_ORIGIN_LABELS[value]}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => updateParams({ q: undefined, status: undefined, origin: undefined, page: undefined })}>
              Limpar
            </Button>
          </div>
          <Button variant="secondary" className="lg:hidden" onClick={() => setMobileFilters((v) => !v)}>
            <SlidersHorizontal className="size-4" /> Filtros
          </Button>
        </div>
        {mobileFilters && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:hidden">
            <Select aria-label="Filtrar por status" value={parsed.status ?? ''} onChange={(e) => updateParams({ status: e.target.value || undefined, page: undefined })}>
              <option value="">Todos os status</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select aria-label="Filtrar por origem" value={parsed.origin ?? ''} onChange={(e) => updateParams({ origin: e.target.value || undefined, page: undefined })}>
              <option value="">Todas as origens</option>
              {STUDENT_ORIGINS.map((value) => (
                <option key={value} value={value}>{STUDENT_ORIGIN_LABELS[value]}</option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Não foi possível carregar os alunos"
            description="Verifique sua conexão e tente novamente."
          />
        ) : !data?.data.length ? (
          <EmptyState
            icon={GraduationCap}
            title="Nenhum aluno encontrado"
            description="Ajuste os filtros ou crie um novo aluno."
          />
        ) : (
          <DataTable
            data={data.data}
            getKey={(row) => row.student_id}
            mobileCard={(row) => <StudentMobileRow row={row} canEdit={canEdit} />}
            columns={[
              { key: 'code', header: 'Código', priority: 'medium', cell: (row) => <span className="font-mono text-xs text-muted">{row.student_code}</span> },
              {
                key: 'name',
                header: 'Aluno',
                cell: (row) => (
                  <button
                    className="text-sm font-semibold text-navy hover:underline"
                    onClick={() => navigate(`/alunos/${row.student_id}`)}
                  >
                    {row.full_name}
                  </button>
                )
              },
              { key: 'contact', header: 'Contato', priority: 'medium', cell: (row) => <span className="text-muted">{row.phone ?? '—'}</span> },
              { key: 'cpf', header: 'CPF', priority: 'low', cell: (row) => <span className="text-muted">{row.cpf ?? '—'}</span> },
              { key: 'registered', header: 'Cadastro', priority: 'low', cell: (row) => new Date(row.registration_date + 'T00:00:00').toLocaleDateString('pt-BR') },
              {
                key: 'status',
                header: 'Status',
                cell: (row) => <Badge variant={STATUS_TONE[row.status]}>{STUDENT_STATUS_LABELS[row.status]}</Badge>
              },
              {
                key: 'actions',
                header: '',
                priority: 'high',
                cell: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/alunos/${row.student_id}`)}>
                    Ver aluno
                  </Button>
                )
              }
            ]}
          />
        )}
      </Card>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Paginação">
        <span className="text-sm text-muted">
          {data?.total ?? 0} aluno{(data?.total ?? 0) === 1 ? '' : 's'} encontrado{(data?.total ?? 0) === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-3">
          <Select
            aria-label="Itens por página"
            value={String(parsed.pageSize)}
            onChange={(e) => updateParams({ page_size: e.target.value, page: undefined })}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size} por página</option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={parsed.page <= 1} onClick={() => updateParams({ page: String(parsed.page - 1) })}>
              Anterior
            </Button>
            <span className="min-w-10 text-center text-sm font-semibold">{parsed.page}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(data?.total ?? 0) <= parsed.page * parsed.pageSize}
              onClick={() => updateParams({ page: String(parsed.page + 1) })}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentMobileRow({ row, canEdit }: { row: StudentListItem; canEdit: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-1.5" role="listitem">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button className="block truncate text-left font-semibold text-navy" onClick={() => navigate(`/alunos/${row.student_id}`)}>
            {row.full_name}
          </button>
          <p className="font-mono text-xs text-muted">{row.student_code}</p>
        </div>
        <Badge variant={STATUS_TONE[row.status]}>{STUDENT_STATUS_LABELS[row.status]}</Badge>
      </div>
      {canEdit && (
        <button className="text-sm font-semibold text-navy hover:underline" onClick={() => navigate(`/alunos/${row.student_id}`)}>
          Ver aluno
        </button>
      )}
    </div>
  )
}