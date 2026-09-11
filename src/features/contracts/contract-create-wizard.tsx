import { CheckCircle2, UserRoundSearch } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCreateContractFromSale } from './contracts-hooks'
import { ContractorSearch, type SelectedContractor } from './contractor-search'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { SALE_PAYMENT_METHOD_LABELS } from '../sales/sales-constants'
import type { SaleDetail } from '../sales/sales-types'
import type { CreateContractResult } from './contracts-types'

type Props = {
  sale: SaleDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STEPS = ['Contratante', 'Revisão', 'Resultado']

export function ContractCreateWizard({ sale, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const canCreate = can(permissions, PERMISSIONS.CONTRACTS_CREATE)
  const createContract = useCreateContractFromSale()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [contractor, setContractor] = useState<SelectedContractor | null>(null)
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<CreateContractResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep(1)
    setContractor(null)
    setNotes('')
    setResult(null)
    setError(null)
  }

  const startReview = () => {
    if (!contractor?.id) {
      toast.error('Selecione o contratante.')
      return
    }
    setStep(2)
  }

  const confirm = async () => {
    if (!contractor?.id) return
    setError(null)
    try {
      const created = await createContract.mutateAsync({
        sale_id: sale.id,
        contractor_person_id: contractor.id,
        contract_notes: notes.trim() || undefined
      })
      setResult(created)
      setStep(3)
    } catch {
      setError('Não foi possível criar o contrato. Verifique se a venda já possui um contrato.')
    }
  }

  const close = () => {
    onOpenChange(false)
    reset()
  }

  return (
    <Modal open={open} onOpenChange={(next) => { if (!next) close() }} title="Gerar contrato">
      {/* Steps indicator */}
      <ol className="mb-5 flex items-center gap-1 text-xs" aria-label="Etapas">
        {STEPS.map((label, index) => {
          const current = index + 1
          const active = current === step
          const done = current < step
          return (
            <li key={label} className="flex flex-1 items-center gap-1">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  done ? 'bg-emerald-600 text-white' : active ? 'bg-navy text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : current}
              </span>
              <span className={active || done ? 'font-semibold text-ink' : 'text-muted'}>{label}</span>
              {current < STEPS.length && <span className="mx-1 h-px flex-1 bg-line" />}
            </li>
          )
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-navy-50 p-3 text-sm text-navy">
            <UserRoundSearch className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">{sale.full_name}</p>
              <p className="text-xs text-muted">
                Venda {sale.sale_code} · {formatCurrency(sale.net_value)} · {formatDateOnly(sale.sale_date)}
              </p>
            </div>
          </div>

          <ContractorSearch canCreate={canCreate} selected={contractor} onSelect={setContractor} />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={close}>Cancelar</Button>
            <Button type="button" onClick={startReview} disabled={!contractor?.id}>Revisar contrato</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-3 text-sm">
            <ReviewRow label="Contratante" value={contractor?.full_name ?? '—'} />
            <ReviewRow label="Aluno" value={sale.student_code} />
            <ReviewRow label="Curso" value={sale.course_name_snapshot} />
            <ReviewRow label="Valor bruto" value={formatCurrency(sale.gross_value)} />
            <ReviewRow label="Desconto" value={formatCurrency(sale.discount_value)} />
            <ReviewRow label="Valor líquido" value={formatCurrency(sale.net_value)} highlight />
            <ReviewRow label="Pagamento" value={SALE_PAYMENT_METHOD_LABELS[sale.payment_method]} />
            <ReviewRow label="Parcelas" value={String(sale.installments)} />
            <ReviewRow label="Vendedor" value={sale.seller_name} />
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Os dados comerciais e acadêmicos serão congelados no contrato. O contratante poderá ser corrigido enquanto o contrato estiver em rascunho.
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Notas do contrato</label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre este contrato..." />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>Voltar</Button>
            <Button
              type="button"
              onClick={confirm}
              loading={createContract.isPending}
              disabled={createContract.isPending}
            >
              Criar contrato em rascunho
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Contrato criado</h3>
            <p className="mt-1 font-mono text-sm font-semibold text-navy">{result.contract_code}</p>
            <p className="mt-1 text-sm text-muted">
              O contrato foi criado em rascunho e pode ser emitido quando estiver pronto.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={close}>Fechar</Button>
            <Button
              onClick={() => {
                close()
                navigate(`/contratos/${result.contract_id}`)
              }}
            >
              Ver contrato
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={highlight ? 'text-lg font-bold text-emerald-700' : 'font-medium'}>{value}</span>
    </div>
  )
}