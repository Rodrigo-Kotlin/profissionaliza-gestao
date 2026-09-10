import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Select, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCreateSaleFromLead } from './sales-hooks'
import { useCrmCourses } from '../crm/crm-hooks'
import { closeSaleSchema, type CloseSaleInput } from './sales-schemas'
import { SALE_PAYMENT_METHODS, SALE_PAYMENT_METHOD_LABELS } from './sales-constants'
import type { CrmLeadDetail } from '../crm/crm-types'
import { formatCurrency } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

type Props = {
  lead: CrmLeadDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CloseSaleModal({ lead, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const createSale = useCreateSaleFromLead()
  const courses = useCrmCourses('ACTIVE')
  const [step, setStep] = useState<1 | 2>(1)
  const [pendingValues, setPendingValues] = useState<CloseSaleInput | null>(null)

  const selectedCourse = courses.data?.find((c) => c.id === pendingValues?.course_id)

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<CloseSaleInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(closeSaleSchema) as any,
    defaultValues: {
      course_id: lead.course_interest_id ?? '',
      gross_value: lead.proposed_value ?? lead.estimated_value ?? (courses.data?.find((c) => c.id === lead.course_interest_id)?.default_price ?? 0),
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1,
      commercial_notes: ''
    }
  })

  const grossValue = watch('gross_value') ?? 0
  const discountValue = watch('discount_value') ?? 0
  const netValue = Math.max(0, grossValue - discountValue)

  useEffect(() => {
    if (open) {
      setStep(1)
      setPendingValues(null)
      reset({
        course_id: lead.course_interest_id ?? '',
        gross_value: lead.proposed_value ?? lead.estimated_value ?? (courses.data?.find((c) => c.id === lead.course_interest_id)?.default_price ?? 0),
        discount_value: 0,
        payment_method: 'PIX',
        installments: 1,
        commercial_notes: ''
      })
    }
  }, [open, lead, reset, courses.data])

  const handleStep1Valid = (values: CloseSaleInput) => {
    setPendingValues(values)
    setStep(2)
  }

  const handleConfirm = async () => {
    if (!pendingValues) return
    try {
      const result = await createSale.mutateAsync({
        lead_id: lead.id,
        course_id: pendingValues.course_id,
        gross_value: pendingValues.gross_value,
        discount_value: pendingValues.discount_value,
        payment_method: pendingValues.payment_method,
        installments: pendingValues.installments,
        commercial_notes: pendingValues.commercial_notes
      })
      toast.success(`Venda ${result.sale_code} criada com sucesso.`)
      onOpenChange(false)
      navigate(`/vendas/${result.sale_id}`)
    } catch {
      toast.error('Não foi possível criar a venda.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Fechar venda">
      {step === 1 ? (
        <form onSubmit={handleSubmit(handleStep1Valid)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Curso *</label>
            <Select {...register('course_id')}>
              <option value="">Selecione o curso</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            {errors.course_id && <p className="mt-1 text-xs text-red-600">{errors.course_id.message}</p>}
          </div>

          {selectedCourse?.default_price != null && (
            <p className="text-xs text-muted">Preço tabela: {formatCurrency(selectedCourse.default_price)}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Valor bruto *"
              type="number"
              step="0.01"
              error={errors.gross_value?.message}
              {...register('gross_value', { valueAsNumber: true })}
            />
            <Input
              label="Desconto"
              type="number"
              step="0.01"
              error={errors.discount_value?.message}
              {...register('discount_value', { valueAsNumber: true })}
            />
          </div>

          <div className="rounded-md bg-navy-50 p-3 text-sm">
            Valor líquido: <span className="font-bold">{formatCurrency(netValue)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Forma de pagamento *</label>
              <Select {...register('payment_method')}>
                {SALE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{SALE_PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </Select>
              {errors.payment_method && <p className="mt-1 text-xs text-red-600">{errors.payment_method.message}</p>}
            </div>
            <Input
              label="Parcelas *"
              type="number"
              min="1"
              error={errors.installments?.message}
              {...register('installments', { valueAsNumber: true })}
            />
          </div>

          <label className="block text-sm font-medium text-ink mb-1.5">Observações comerciais</label>
          <Textarea rows={3} {...register('commercial_notes')} />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">
              Revisar venda
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 text-sm">
            <ReviewRow label="Cliente" value={lead.full_name} />
            <ReviewRow label="Curso" value={selectedCourse?.name ?? pendingValues?.course_id ?? '—'} />
            {selectedCourse?.default_price != null && (
              <ReviewRow label="Preço tabela" value={formatCurrency(selectedCourse.default_price)} />
            )}
            <ReviewRow label="Valor bruto" value={formatCurrency(pendingValues?.gross_value ?? 0)} />
            <ReviewRow label="Desconto" value={formatCurrency(pendingValues?.discount_value ?? 0)} />
            <ReviewRow label="Valor líquido" value={formatCurrency(netValue)} highlight />
            <ReviewRow label="Pagamento" value={SALE_PAYMENT_METHOD_LABELS[pendingValues?.payment_method as keyof typeof SALE_PAYMENT_METHOD_LABELS] ?? '—'} />
            <ReviewRow label="Parcelas" value={String(pendingValues?.installments ?? 1)} />
            <ReviewRow label="Vendedor" value={lead.owner_name ?? '—'} />
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            Esta ação registrará a venda e encerrará o Lead como ganho.
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>Voltar</Button>
            <Button type="button" onClick={handleConfirm} loading={createSale.isPending} disabled={createSale.isPending}>
              Confirmar venda
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
