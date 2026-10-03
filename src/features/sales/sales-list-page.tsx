import { ShoppingBag, Search, X, CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useSaleList } from './sales-hooks'
import { useCrmCourses } from '../crm/crm-hooks'
import { SALE_STATUS_LABELS, SALE_STATUS_TONES, SALE_PAYMENT_METHOD_LABELS, SALE_PAGE_SIZE } from './sales-constants'
import { parseSaleListParams } from './sales-utils'
import { updateSearchParams } from '@/lib/url-params'
import { computeTotalPages, useNormalizedPage } from '@/lib/pagination'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import type { SaleListItem } from './sales-types'

export function SalesPage() {
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const hasViewAll = can(permissions, PERMISSIONS.SALES_VIEW_ALL)
  const [params, setParams] = useSearchParams()

  const parsed = useMemo(() => parseSaleListParams(params), [params])
  const [searchQuery, setSearchQuery] = useState(parsed.q ?? '')

  const updateParams = (next: Record<string, string | number | undefined | null>) =>
    setParams(updateSearchParams(params, next), { replace: true })

  const courses = useCrmCourses('ACTIVE')

  const sellersQuery = useQuery({
    queryKey: ['sellers'],
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

  const query = useSaleList({
    search: parsed.q,
    status: parsed.status,
    seller_user_id: parsed.seller,
    course_id: parsed.course,
    date_from: parsed.date_from,
    date_to: parsed.date_to,
    page: parsed.page,
    page_size: SALE_PAGE_SIZE
  })

  const sales = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const totalPages = computeTotalPages(total, SALE_PAGE_SIZE)
  useNormalizedPage(total, parsed.page, totalPages, (page) => updateParams({ page }))

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" description="Vendas realizadas no sistema." />

      {/* Filters row 1: Search + Status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" />
          <Input
            placeholder="Buscar por código ou cliente..."
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
          {([['', 'Todas'], ['CONFIRMED', 'Confirmadas'], ['CANCELED', 'Canceladas']] as const).map(([key, label]) => (
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
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : query.isError ? (
          <EmptyState icon={ShoppingBag} title="Erro ao carregar vendas" description="Tente novamente mais tarde." />
        ) : sales.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Nenhuma venda encontrada" description={parsed.q ? 'Tente outro termo de busca.' : 'Ainda não há vendas registradas.'} />
        ) : (
          <>
            <DataTable
              data={sales}
              getKey={(row) => row.id}
              mobileCard={(row) => <SaleMobileRow row={row} />}
              columns={[
                {
                  key: 'code',
                  header: 'Código',
                  cell: (row) => (
                    <button
                      className="font-mono text-xs font-semibold text-navy hover:underline"
                      onClick={() => navigate(`/vendas/${row.id}`)}
                    >
                      {row.sale_code}
                    </button>
                  )
                },
                {
                  key: 'client',
                  header: 'Cliente',
                  cell: (row) => (
                    <button
                      className="text-sm font-semibold text-navy hover:underline"
                      onClick={() => navigate(`/vendas/${row.id}`)}
                    >
                      {row.full_name}
                    </button>
                  )
                },
                { key: 'course', header: 'Curso', priority: 'medium', cell: (row) => <span className="text-muted">{row.course_name}</span> },
                { key: 'seller', header: 'Vendedor', priority: 'low', cell: (row) => <span className="text-muted">{row.seller_name}</span> },
                { key: 'value', header: 'Valor', cell: (row) => <span className="font-medium">{formatCurrency(row.net_value)}</span> },
                { key: 'payment', header: 'Pagamento', priority: 'low', cell: (row) => <span className="text-muted">{SALE_PAYMENT_METHOD_LABELS[row.payment_method]}</span> },
                { key: 'status', header: 'Status', cell: (row) => <Badge variant={SALE_STATUS_TONES[row.status]}>{SALE_STATUS_LABELS[row.status]}</Badge> },
                { key: 'date', header: 'Data', priority: 'medium', cell: (row) => <span className="text-muted">{formatDateOnly(row.sale_date.slice(0, 10))}</span> }
              ]}
            />

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4">
                <span className="text-xs text-muted">
                  {total} venda{total !== 1 ? 's' : ''} · Página {parsed.page} de {totalPages}
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

function SaleMobileRow({ row }: { row: SaleListItem }) {
  const navigate = useNavigate()
  return (
    <div className="min-w-0 space-y-1.5" role="listitem">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 max-w-full">
          <button className="block max-w-full break-words text-left font-mono text-xs font-semibold text-navy" onClick={() => navigate(`/vendas/${row.id}`)}>
            {row.sale_code}
          </button>
          <button className="block max-w-full break-words text-left text-sm font-semibold" onClick={() => navigate(`/vendas/${row.id}`)}>
            {row.full_name}
          </button>
        </div>
        <Badge className="shrink-0" variant={SALE_STATUS_TONES[row.status]}>{SALE_STATUS_LABELS[row.status]}</Badge>
      </div>
      <p className="break-words text-sm text-muted">{row.course_name}</p>
      <p className="truncate text-sm font-medium">{formatCurrency(row.net_value)}</p>
      <p className="break-words text-xs text-muted">{formatDateOnly(row.sale_date.slice(0, 10))}</p>
      <Button
        variant="ghost"
        className="h-11 px-2"
        onClick={() => navigate(`/vendas/${row.id}`)}
      >
        Ver venda
      </Button>
    </div>
  )
}
