import { ShoppingBag, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui/core'
import { useSaleList } from './sales-hooks'
import { SALE_STATUS_LABELS, SALE_STATUS_TONES, SALE_PAYMENT_METHOD_LABELS, SALE_PAGE_SIZE } from './sales-constants'
import { formatCurrency } from '@/lib/utils'

export function SalesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)

  const query = useSaleList({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    page_size: SALE_PAGE_SIZE
  })

  const sales = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / SALE_PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" description="Vendas realizadas no sistema." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted" />
          <Input
            placeholder="Buscar por código ou cliente..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1) }}
              className="absolute right-3 top-2.5 text-muted hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {([['', 'Todas'], ['CONFIRMED', 'Confirmadas'], ['CANCELED', 'Canceladas']] as const).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={statusFilter === key ? 'primary' : 'ghost'}
              onClick={() => { setStatusFilter(key); setPage(1) }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : query.isError ? (
        <Card>
          <EmptyState icon={ShoppingBag} title="Erro ao carregar vendas" description="Tente novamente mais tarde." />
        </Card>
      ) : sales.length === 0 ? (
        <Card>
          <EmptyState icon={ShoppingBag} title="Nenhuma venda encontrada" description={search ? 'Tente outro termo de busca.' : 'Ainda não há vendas registradas.'} />
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs font-medium text-muted">
                  <th className="pb-3 pr-4">Código</th>
                  <th className="pb-3 pr-4">Cliente</th>
                  <th className="pb-3 pr-4">Curso</th>
                  <th className="pb-3 pr-4">Vendedor</th>
                  <th className="pb-3 pr-4 text-right">Valor</th>
                  <th className="pb-3 pr-4">Pagamento</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-navy-50/50"
                    onClick={() => navigate(`/vendas/${sale.id}`)}
                  >
                    <td className="py-3 pr-4 font-mono text-xs font-semibold">{sale.sale_code}</td>
                    <td className="py-3 pr-4 font-medium">{sale.full_name}</td>
                    <td className="py-3 pr-4 text-muted">{sale.course_name}</td>
                    <td className="py-3 pr-4 text-muted">{sale.seller_name}</td>
                    <td className="py-3 pr-4 text-right font-medium">{formatCurrency(sale.net_value)}</td>
                    <td className="py-3 pr-4 text-muted">{SALE_PAYMENT_METHOD_LABELS[sale.payment_method]}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={SALE_STATUS_TONES[sale.status]}>{SALE_STATUS_LABELS[sale.status]}</Badge>
                    </td>
                    <td className="py-3 text-muted">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted">
                {total} venda{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
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
    </div>
  )
}
