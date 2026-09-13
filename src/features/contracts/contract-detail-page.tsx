import {
  ArrowLeft, Ban, BookOpen, CheckCircle2, Clock, CreditCard, Eye, FileSignature,
  MapPin, PencilLine, Send, ShoppingBag, User, Users
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/core'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { useContractDetail, useContractTimeline } from './contracts-hooks'
import { EditContractDialog } from './edit-contract-dialog'
import { IssueContractDialog } from './issue-contract-dialog'
import { SignContractDialog } from './sign-contract-dialog'
import { CancelContractDialog } from './cancel-contract-dialog'
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES, CONTRACT_COURSE_MODALITY_LABELS } from './contracts-constants'
import { isCancelAllowed, isEditDraftAllowed, isIssueAllowed, isSignAllowed, formatContractAddress } from './contracts-utils'
import { SALE_PAYMENT_METHOD_LABELS } from '../sales/sales-constants'
import type { ContractDetail as ContractDetailType, ContractTimelineEvent } from './contracts-types'

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const contractId = id ?? ''

  const [editOpen, setEditOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const detail = useContractDetail(contractId)
  const timeline = useContractTimeline(contractId)

  if (detail.isLoading) return <PageSkeleton />

  if (detail.isError || !detail.data) {
    return (
      <Card>
        <EmptyState icon={Eye} title="Contrato não encontrado" description="Verifique o link ou tente novamente." />
      </Card>
    )
  }

  const contract = detail.data
  const events = timeline.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Contrato">
        <Button variant="secondary" onClick={() => navigate('/contratos')}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <ContractActions contract={contract} permissions={permissions}
          onEdit={() => setEditOpen(true)}
          onIssue={() => setIssueOpen(true)}
          onSign={() => setSignOpen(true)}
          onCancel={() => setCancelOpen(true)}
        />
      </PageHeader>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">{contract.contract_code}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge variant={CONTRACT_STATUS_TONES[contract.status]}>{CONTRACT_STATUS_LABELS[contract.status]}</Badge>
              <span className="text-sm text-muted">Criado em {formatDateOnly(contract.created_at.slice(0, 10))}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(contract.net_value_snapshot)}</p>
            <p className="text-xs text-muted">
              Bruto: {formatCurrency(contract.gross_value_snapshot)}
              {contract.discount_value_snapshot > 0 && ` · Desconto: -${formatCurrency(contract.discount_value_snapshot)}`}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Origem */}
        <Card className="p-5">
          <SectionHeader icon={ShoppingBag} title="Origem" />
          <dl className="space-y-2 text-sm">
            <Row label="Venda" value={contract.sale_code} />
            <Row label="Vendedor" value={contract.seller_name} />
            <Row label="Status da venda" value={contract.sale_status} />
          </dl>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => navigate(`/vendas/${contract.sale_id}`)}>
            Ver venda
          </Button>
        </Card>

        {/* Contratante */}
        <Card className="p-5">
          <SectionHeader icon={Users} title="Contratante" />
          {!contract.sensitive && (
            <p className="mb-2 rounded-md bg-navy-50 p-2 text-xs text-muted">
              CPF, telefone, e-mail e endereço completos ficam ocultos sem a permissão de visualização sensível.
            </p>
          )}
          <dl className="space-y-2 text-sm">
            <Row label="Nome" value={contract.contractor_name} />
            <Row label="CPF" value={contract.contractor_cpf ?? '—'} />
            <Row label="E-mail" value={contract.contractor_email ?? '—'} />
            <Row label="Telefone" value={contract.contractor_phone ?? '—'} />
          </dl>
          {contract.contractor_address && (
            <div className="mt-3 flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
              <p className="whitespace-pre-line text-muted">{formatContractAddress(contract.contractor_address)}</p>
            </div>
          )}
        </Card>

        {/* Aluno */}
        <Card className="p-5">
          <SectionHeader icon={User} title="Aluno" />
          <dl className="space-y-2 text-sm">
            <Row label="Nome" value={contract.student_name} />
            <Row label="Código" value={contract.student_code} />
          </dl>
        </Card>

        {/* Curso */}
        <Card className="p-5">
          <SectionHeader icon={BookOpen} title="Curso" />
          <dl className="space-y-2 text-sm">
            <Row label="Curso" value={contract.course_name_snapshot} />
            <Row label="Carga horária" value={contract.course_workload_snapshot != null ? `${contract.course_workload_snapshot}h` : '—'} />
            <Row label="Modalidade" value={CONTRACT_COURSE_MODALITY_LABELS[contract.course_modality_snapshot] ?? '—'} />
          </dl>
        </Card>

        {/* Condições comerciais */}
        <Card className="p-5">
          <SectionHeader icon={CreditCard} title="Condições comerciais" />
          <dl className="space-y-2 text-sm">
            <Row label="Valor bruto" value={formatCurrency(contract.gross_value_snapshot)} />
            <Row label="Desconto" value={formatCurrency(contract.discount_value_snapshot)} />
            <Row label="Valor líquido" value={formatCurrency(contract.net_value_snapshot)} highlight />
            <Row label="Pagamento" value={SALE_PAYMENT_METHOD_LABELS[contract.payment_method_snapshot as keyof typeof SALE_PAYMENT_METHOD_LABELS] ?? contract.payment_method_snapshot} />
            <Row label="Parcelas" value={String(contract.installments_snapshot)} />
          </dl>
        </Card>

        {/* Datas / status */}
        <Card className="p-5">
          <SectionHeader icon={Clock} title="Ciclo de vida" />
          <dl className="space-y-2 text-sm">
            <Row label="Criado em" value={formatDateOnly(contract.created_at.slice(0, 10))} />
            <Row label="Emitido em" value={contract.issued_at ? formatDateTime(contract.issued_at) : '—'} />
            <Row label="Assinado em" value={contract.signed_at ? formatDateTime(contract.signed_at) : '—'} />
            <Row label="Cancelado em" value={contract.canceled_at ? formatDateTime(contract.canceled_at) : '—'} />
          </dl>
          {contract.status === 'CANCELED' && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50/50 p-3 text-sm">
              <p className="font-semibold text-red-700">Cancelamento</p>
              <p className="mt-1 text-muted">{contract.cancellation_reason ?? '—'}</p>
              {contract.canceled_by_name && (
                <p className="mt-1 text-xs text-muted">Por {contract.canceled_by_name}</p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Observações comerciais e notas */}
      {(contract.commercial_notes_snapshot || contract.contract_notes) && (
        <Card className="p-5">
          <SectionHeader icon={FileSignature} title="Observações" />
          {contract.commercial_notes_snapshot && (
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Observações comerciais (venda)</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{contract.commercial_notes_snapshot}</p>
            </div>
          )}
          {contract.contract_notes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Notas do contrato</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{contract.contract_notes}</p>
            </div>
          )}
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
          <ol className="space-y-1 border-l-2 border-line">
            {events.map((evt) => (
              <ContractTimelineRow key={evt.id} event={evt} />
            ))}
          </ol>
        )}
      </Card>

      <EditContractDialog contract={contract} open={editOpen} onOpenChange={setEditOpen} />
      <IssueContractDialog contract={contract} open={issueOpen} onOpenChange={setIssueOpen} />
      <SignContractDialog contract={contract} open={signOpen} onOpenChange={setSignOpen} />
      <CancelContractDialog
        contractId={contract.contract_id}
        contractCode={contract.contract_code}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </div>
  )
}

function ContractActions({
  contract,
  permissions,
  onEdit,
  onIssue,
  onSign,
  onCancel
}: {
  contract: ContractDetailType
  permissions: readonly string[]
  onEdit: () => void
  onIssue: () => void
  onSign: () => void
  onCancel: () => void
}) {
  if (isEditDraftAllowed(contract.status) && can(permissions, PERMISSIONS.CONTRACTS_EDIT_DRAFT)) {
    return (
      <Button variant="secondary" onClick={onEdit}>
        <PencilLine className="size-4" /> Editar rascunho
      </Button>
    )
  }
  if (isIssueAllowed(contract.status) && can(permissions, PERMISSIONS.CONTRACTS_ISSUE)) {
    return (
      <Button variant="secondary" onClick={onIssue}>
        <Send className="size-4" /> Emitir contrato
      </Button>
    )
  }
  if (isSignAllowed(contract.status) && can(permissions, PERMISSIONS.CONTRACTS_MARK_SIGNED)) {
    return (
      <Button onClick={onSign}>
        <CheckCircle2 className="size-4" /> Registrar assinatura
      </Button>
    )
  }
  if (isCancelAllowed(contract.status) && can(permissions, PERMISSIONS.CONTRACTS_CANCEL)) {
    return (
      <Button variant="danger" onClick={onCancel}>
        <Ban className="size-4" /> Cancelar contrato
      </Button>
    )
  }
  return null
}

function ContractTimelineRow({ event }: { event: ContractTimelineEvent }) {
  const map: Record<string, { Icon: React.ElementType; color: string }> = {
    'contracts.created': { Icon: CheckCircle2, color: 'text-emerald-600' },
    'contracts.updated_draft': { Icon: PencilLine, color: 'text-slate-500' },
    'contracts.issued': { Icon: Send, color: 'text-amber-600' },
    'contracts.signed': { Icon: CheckCircle2, color: 'text-emerald-600' },
    'contracts.canceled': { Icon: Ban, color: 'text-red-500' }
  }
  const { Icon, color } = map[event.event_type] ?? { Icon: Clock, color: 'text-slate-500' }

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
          <span>{formatDateTime(event.occurred_at)}</span>
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

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-medium ${highlight ? 'font-bold text-emerald-700' : ''}`}>{value}</dd>
    </div>
  )
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando contrato">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-32" />
      <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
    </div>
  )
}