import { CalendarDays, FileSignature, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useContractList } from './contracts-hooks'
import { useCrmCourses } from '../crm/crm-hooks'
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES, CONTRACT_PAGE_SIZE } from './contracts-constants'
import { parseContractListParams } from './contracts-utils'
import { updateSearchParams } from '@/lib/url-params'
import { computeTotalPages, useNormalizedPage } from '@/lib/pagination'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import type { ContractListItem } from './contracts-types'

export function ContractsPage() {
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const hasViewAll = can(permissions, PERMISSIONS.CONTRACTS_VIEW_ALL)
  const [params, setParams] = useSearchParams()

  const parsed = useMemo(() => parseContractListParams(params), [params])
  const [searchQuery, setSearchQuery] = useState(parsed.q ?? '')

  const updateParams = (next: Record<string, string | number | undefined | null>) =>
    setParams(updateSearchParams(params, next), { replace: true })

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
    search: parsed.q,
    status: parsed.status,
    seller_user_id: parsed.seller,
    course_id: parsed.course,
    date_from: parsed.date_from,
    date_to: parsed.date_to,
    page: parsed.page,
    page_size: CONTRACT_PAGE_SIZE
  })

  const contracts = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const totalPages = computeTotalPages(total, CONTRACT_PAGE_SIZE)
  useNormalizedPage(total, parsed.page, totalPages, (page) => updateParams({ page }))

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
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); updateParams({ q: e.target.value || undefined }) }}
          />
          {parsed.q && (
            <Button
              type="button"
              aria-label="Limpar busca"
              variant="ghost"
              onClick={() => { setSearchQuery(''); updateParams({ q: undefined }) }}
              className="absolute right-1 top-1 grid size-11 place-items-center rounded-lg px-0 text-muted hover:text-ink"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {([['', 'Todos'], ['DRAFT', 'Rascunhos'], ['PENDING_SIGNATURE', 'Aguardando'], ['SIGNED', 'Assinados'], ['CANCELED', 'Cancelados']] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              className="px-3"
              variant={parsed.status === key ? 'primary' : 'ghost'}
              onClick={() => updateParams({ status: key || undefined })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters row 2: Seller (view_all only) + Course + Period */}
      <div className="flex flex-wrap items-center gap-3">
        {hasViewAll && (
          <Select value={parsed.seller ?? ''} onChange={(e) => updateParams({ seller: e.target.value || undefined })}>
            <option value="">Todos os vendedores</option>
            {sellersQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
        )}

        <Select value={parsed.course ?? ''} onChange={(e) => updateParams({ course: e.target.value || undefined })}>
          <option value="">Todos os cursos</option>
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <div className="w-full sm:w-auto">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:items-center sm:gap-2">
            <CalendarDays className="size-4 text-muted" />
            <Input
              type="date"
              aria-label="Data inicial"
              value={parsed.date_from ?? ''}
              onChange={(e) => updateParams({ date_from: e.target.value || undefined })}
              className="min-w-0 w-full sm:w-[150px]"
              placeholder="De"
            />
            <span className="text-muted">até</span>
            <Input
              type="date"
              aria-label="Data final"
              value={parsed.date_to ?? ''}
              onChange={(e) => updateParams({ date_to: e.target.value || undefined })}
              className="min-w-0 w-full sm:w-[150px]"
              placeholder="Até"
            />
          </div>
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
            description={parsed.q ? 'Tente outro termo de busca.' : 'Contratos são gerados a partir de vendas confirmadas.'}
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
                    <Button variant="ghost" className="px-3" onClick={() => navigate(`/contratos/${row.contract_id}`)}>
                      Ver contrato
                    </Button>
                  )
                }
              ]}
            />

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 pb-2 pt-4">
                <span className="text-xs text-muted">
                  {total} contrato{total !== 1 ? 's' : ''} · Página {parsed.page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" className="px-3" disabled={parsed.page <= 1} onClick={() => updateParams({ page: parsed.page - 1 })}>
                    Anterior
                  </Button>
                  <Button variant="ghost" className="px-3" disabled={parsed.page >= totalPages} onClick={() => updateParams({ page: parsed.page + 1 })}>
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
    <div className="min-w-0 space-y-1.5" role="listitem">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 max-w-full">
          <button className="block max-w-full break-words text-left font-mono text-xs font-semibold text-navy" onClick={() => navigate(`/contratos/${row.contract_id}`)}>
            {row.contract_code}
          </button>
          <p className="break-words text-sm font-semibold">{row.student_name}</p>
          <p className="break-words text-xs text-muted">{row.contractor_name}</p>
        </div>
        <Badge className="shrink-0" variant={CONTRACT_STATUS_TONES[row.status]}>{CONTRACT_STATUS_LABELS[row.status]}</Badge>
      </div>
      <p className="text-sm font-medium">{formatCurrency(row.net_value_snapshot)}</p>
      <p className="break-words text-xs text-muted">{row.course_name}</p>
      <Button variant="ghost" className="h-11 px-2" onClick={() => navigate(`/contratos/${row.contract_id}`)}>
        Ver contrato
      </Button>
    </div>
  )
}
