import { CalendarDays, FileSignature, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useContractList } from './contracts-hooks'
import { useCrmCourses } from '../crm/crm-hooks'
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES, CONTRACT_PAGE_SIZE } from './contracts-constants'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import type { ContractListItem } from './contracts-types'

export function ContractsPage() {
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const hasViewAll = can(permissions, PERMISSIONS.CONTRACTS_VIEW_ALL)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sellerFilter, setSellerFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const courses = useCrmCourses('ACTIVE')

  const sellersQuery = useQuery({
    queryKey: ['contract-sellers'],
    enabled: hasViewAll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name')
      if (error) throw error
      return data as { id: string; full_name: string }[]
    }
  })

  const query = useContractList({
    search: search || undefined,
    status: statusFilter || undefined,
    seller_user_id: sellerFilter || undefined,
    course_id: courseFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page,
    page_size: CONTRACT_PAGE_SIZE
  })

  const contracts = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / CONTRACT_PAGE_SIZE))

  const resetPage = () => setPage(1)

  return (
    <div className="space-y-6">
      <PageHeader title="Contratos" description="Contratos gerados a partir das vendas confirmadas." />

      {/* Filters row 1: Search + Status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" />
          <Input
            placeholder="Buscar por código, aluno ou contratante..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage() }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); resetPage() }}
              className="absolute right-3 top-2.5 text-muted hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {([['', 'Todos'], ['DRAFT', 'Rascunhos'], ['PENDING_SIGNATURE', 'Aguardando'], ['SIGNED', 'Assinados'], ['CANCELED', 'Cancelados']] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={statusFilter === key ? 'primary' : 'ghost'}
              onClick={() => { setStatusFilter(key); resetPage() }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters row 2: Seller (view_all only) + Course + Period */}
      <div className="flex flex-wrap items-center gap-3">
        {hasViewAll && (
          <Select value={sellerFilter} onChange={(e) => { setSellerFilter(e.target.value); resetPage() }}>
            <option value="">Todos os vendedores</option>
            {sellersQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
        )}

        <Select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); resetPage() }}>
          <option value="">Todos os cursos</option>
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); resetPage() }}
            className="w-[150px]"
            placeholder="De"
          />
          <span className="text-muted">até</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); resetPage() }}
            className="w-[150px]"
            placeholder="Até"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : query.isError ? (
          <EmptyState icon={FileSignature} title="Erro ao carregar contratos" description="Tente novamente mais tarde." />
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="Nenhum contrato encontrado"
            description={search ? 'Tente outro termo de busca.' : 'Contratos são gerados a partir de vendas confirmadas.'}
          />
        ) : (
          <>
            <DataTable
              data={contracts}
              getKey={(row) => row.contract_id}
              mobileCard={(row) => <ContractMobileRow row={row} />}
              columns={[
                {
                  key: 'code',
                  header: 'Código',
                  cell: (row) => (
                    <button
                      className="font-mono text-xs font-semibold text-navy hover:underline"
                      onClick={() => navigate(`/contratos/${row.contract_id}`)}
                    >
                      {row.contract_code}
                    </button>
                  )
                },
                {
                  key: 'student',
                  header: 'Aluno',
                  priority: 'medium',
                  cell: (row) => (
                    <button
                      className="text-sm font-semibold text-navy hover:underline"
                      onClick={() => navigate(`/contratos/${row.contract_id}`)}
                    >
                      {row.student_name}
                    </button>
                  )
                },
                { key: 'contractor', header: 'Contratante', priority: 'medium', cell: (row) => <span className="text-muted">{row.contractor_name}</span> },
                { key: 'course', header: 'Curso', priority: 'low', cell: (row) => <span className="text-muted">{row.course_name}</span> },
                { key: 'seller', header: 'Vendedor', priority: 'low', cell: (row) => <span className="text-muted">{row.seller_name}</span> },
                { key: 'value', header: 'Valor', cell: (row) => <span className="font-medium">{formatCurrency(row.net_value_snapshot)}</span> },
                { key: 'status', header: 'Status', cell: (row) => <Badge variant={CONTRACT_STATUS_TONES[row.status]}>{CONTRACT_STATUS_LABELS[row.status]}</Badge> },
                { key: 'date', header: 'Criado em', priority: 'medium', cell: (row) => <span className="text-muted">{formatDateOnly(row.created_at.slice(0, 10))}</span> },
                {
                  key: 'actions',
                  header: '',
                  cell: (row) => (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/contratos/${row.contract_id}`)}>
                      Ver contrato
                    </Button>
                  )
                }
              ]}
            />

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 pb-2 pt-4">
                <span className="text-xs text-muted">
                  {total} contrato{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function ContractMobileRow({ row }: { row: ContractListItem }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-1.5" role="listitem">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button className="block truncate text-left font-mono text-xs font-semibold text-navy" onClick={() => navigate(`/contratos/${row.contract_id}`)}>
            {row.contract_code}
          </button>
          <p className="truncate text-sm font-semibold">{row.student_name}</p>
          <p className="truncate text-xs text-muted">{row.contractor_name}</p>
        </div>
        <Badge variant={CONTRACT_STATUS_TONES[row.status]}>{CONTRACT_STATUS_LABELS[row.status]}</Badge>
      </div>
      <p className="text-sm font-medium">{formatCurrency(row.net_value_snapshot)}</p>
      <p className="text-xs text-muted">{row.course_name}</p>
      <button className="text-sm font-semibold text-navy hover:underline" onClick={() => navigate(`/contratos/${row.contract_id}`)}>
        Ver contrato
      </button>
    </div>
  )
}