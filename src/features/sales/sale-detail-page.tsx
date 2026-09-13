import { ArrowLeft, Ban, CalendarDays, Eye, FileSignature, ShoppingBag, User, CreditCard, BookOpen, Clock, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/core'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { useSaleDetail, useSaleTimeline } from './sales-hooks'
import { CancelSaleDialog } from './cancel-sale-dialog'
import { SALE_STATUS_LABELS, SALE_STATUS_TONES, SALE_PAYMENT_METHOD_LABELS } from './sales-constants'
import type { SaleTimelineEvent } from './sales-types'
import { ContractCreateWizard } from '../contracts/contract-create-wizard'
import { canCreateContractFromSale } from '../contracts/contracts-utils'

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { permissions, user } = useAuth()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)
  const saleId = id ?? ''

  const detail = useSaleDetail(saleId)
  const timeline = useSaleTimeline(saleId)
  const canCancel = can(permissions, PERMISSIONS.SALES_CANCEL)

  if (detail.isLoading) return <PageSkeleton />

  if (detail.isError || !detail.data) {
    return (
      <Card>
        <EmptyState icon={Eye} title="Venda não encontrada" description="Verifique o link ou tente novamente." />
      </Card>
    )
  }

  const sale = detail.data
  const showCancel = canCancel && sale.status === 'CONFIRMED'
  const events = timeline.data?.data ?? []
  const canCreateContract = canCreateContractFromSale(sale, permissions, user?.id ?? '')

  return (
    <div className="space-y-6">
      <PageHeader title="Venda">
        <Button variant="secondary" onClick={() => navigate('/vendas')}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        {canCreateContract && (
          <Button onClick={() => setContractOpen(true)}>
            <FileSignature className="size-4" /> Gerar contrato
          </Button>
        )}
        {showCancel && (
          <Button variant="danger" onClick={() => setCancelOpen(true)}>
            <Ban className="size-4" /> Cancelar venda
          </Button>
        )}
      </PageHeader>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{sale.sale_code}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge variant={SALE_STATUS_TONES[sale.status]}>{SALE_STATUS_LABELS[sale.status]}</Badge>
              <span className="text-sm text-muted">
                {formatDateOnly(sale.sale_date)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(sale.net_value)}</p>
            <p className="text-xs text-muted">
              Bruto: {formatCurrency(sale.gross_value)}
              {sale.discount_value > 0 && ` · Desconto: -${formatCurrency(sale.discount_value)}`}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Cliente / Student */}
        <Card className="p-5">
          <SectionHeader icon={User} title="Cliente" />
          <dl className="space-y-2 text-sm">
            <Row label="Nome" value={sale.full_name} />
            <Row label="Aluno" value={sale.student_code} />
          </dl>
        </Card>

        {/* Curso */}
        <Card className="p-5">
          <SectionHeader icon={BookOpen} title="Curso" />
          <dl className="space-y-2 text-sm">
            <Row label="Curso" value={sale.course_name_snapshot} />
            <Row label="Preço tabela" value={sale.course_price_snapshot != null ? formatCurrency(sale.course_price_snapshot) : 'Não informado'} />
          </dl>
        </Card>

        {/* Pagamento */}
        <Card className="p-5">
          <SectionHeader icon={CreditCard} title="Pagamento" />
          <dl className="space-y-2 text-sm">
            <Row label="Forma" value={SALE_PAYMENT_METHOD_LABELS[sale.payment_method]} />
            <Row label="Parcelas" value={String(sale.installments)} />
            <Row label="Data da venda" value={formatDateOnly(sale.sale_date)} />
          </dl>
        </Card>

        {/* Vendedor */}
        <Card className="p-5">
          <SectionHeader icon={User} title="Vendedor" />
          <dl className="space-y-2 text-sm">
            <Row label="Responsável" value={sale.seller_name} />
            <Row label="Criado por" value={sale.created_by_name ?? '—'} />
          </dl>
        </Card>
      </div>

      {/* CRM Lead link */}
      {sale.lead_id && (
        <Card className="p-5">
          <SectionHeader icon={ShoppingBag} title="Origem CRM" />
          <dl className="space-y-2 text-sm">
            <Row label="Lead" value={sale.lead_code ?? '—'} />
          </dl>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => navigate(`/crm/leads/${sale.lead_id}`)}
          >
            Ver lead
          </Button>
        </Card>
      )}

      {/* Contrato */}
      <Card className="p-5">
        <SectionHeader icon={FileSignature} title="Contrato" />
        {sale.contract_id ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <dl className="space-y-2 text-sm">
              <Row label="Contrato" value={sale.contract_code ?? '—'} />
              <Row label="Status" value={contractStatusText(sale.contract_status)} />
            </dl>
            <Button size="sm" variant="ghost" onClick={() => navigate(`/contratos/${sale.contract_id}`)}>
              Ver contrato
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {sale.status === 'CONFIRMED'
                ? 'Esta venda ainda não possui contrato.'
                : 'Nenhum contrato foi gerado para esta venda.'}
            </p>
            {canCreateContract && (
              <Button size="sm" onClick={() => setContractOpen(true)}>
                <FileSignature className="size-4" /> Gerar contrato
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Observações */}
      {sale.commercial_notes && (
        <Card className="p-5">
          <SectionHeader icon={CalendarDays} title="Observações comerciais" />
          <p className="whitespace-pre-wrap text-sm text-muted">{sale.commercial_notes}</p>
        </Card>
      )}

      {/* Cancelamento */}
      {sale.status === 'CANCELED' && (
        <Card className="p-5 border-red-200 bg-red-50/50">
          <SectionHeader icon={Ban} title="Cancelamento" />
          <dl className="space-y-2 text-sm">
            <Row label="Motivo" value={sale.cancellation_reason ?? '—'} />
            <Row label="Cancelado por" value={sale.canceled_by_name ?? '—'} />
            <Row label="Data" value={sale.canceled_at ? new Date(sale.canceled_at).toLocaleString('pt-BR') : '—'} />
          </dl>
        </Card>
      )}

      {/* Histórico */}
      <Card className="p-5">
        <SectionHeader icon={Clock} title="Histórico" />
        {timeline.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted">Nenhum evento registrado.</p>
        ) : (
          <ol className="space-y-1 border-l-2 border-line pl-0">
            {events.map((evt) => (
              <SaleTimelineRow key={evt.id} event={evt} />
            ))}
          </ol>
        )}
      </Card>

      <CancelSaleDialog
        saleId={sale.id}
        saleCode={sale.sale_code}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onCancelled={() => navigate('/vendas')}
      />

      <ContractCreateWizard
        sale={sale}
        open={contractOpen}
        onOpenChange={setContractOpen}
      />
    </div>
  )
}

function contractStatusText(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    DRAFT: 'Rascunho',
    PENDING_SIGNATURE: 'Aguardando assinatura',
    SIGNED: 'Assinado',
    CANCELED: 'Cancelado'
  }
  return status ? (labels[status] ?? status) : '—'
}

function SaleTimelineRow({ event }: { event: SaleTimelineEvent }) {
  const isCreated = event.event_type === 'sales.created'
  const Icon = isCreated ? CheckCircle2 : Ban
  const color = isCreated ? 'text-emerald-600' : 'text-red-500'

  return (
    <li className="relative pl-6">
      <span className="absolute -left-[9px] top-1 size-4 rounded-full border-2 border-line bg-white flex items-center justify-center">
        <Icon className={`size-2.5 ${color}`} />
      </span>
      <div className="pb-5">
        <p className="text-sm font-semibold">{event.title}</p>
        {event.description && (
          <p className="mt-0.5 text-xs text-muted">{event.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span>{new Date(event.occurred_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          {event.actor_name && (
            <>
              <span>·</span>
              <span>{event.actor_name}</span>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-4 text-muted" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando venda">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-32" />
      <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
    </div>
  )
}
