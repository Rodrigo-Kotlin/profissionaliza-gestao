import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { offlineAwareMessage } from '@/lib/offline'
import { Button, Input, Select, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCourseOffers, useCreateSaleFromCommercialOffer, usePricePlans } from './sales-hooks'
import { closeSaleSchema, type CloseSaleInput } from './sales-schemas'
import type { CrmLeadDetail } from '../crm/crm-types'
import { formatCurrency } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { CommercialPaymentMethod } from '@/types/database'

type Props = { lead: CrmLeadDetail; open: boolean; onOpenChange: (open: boolean) => void }

const paymentLabels: Record<CommercialPaymentMethod, string> = {
  PIX: 'PIX', CASH: 'À vista', DEBIT: 'Cartão de débito', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', OTHER: 'Outro'
}

export function CloseSaleModal({ lead, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const createSale = useCreateSaleFromCommercialOffer()
  const offers = useCourseOffers()
  const [step, setStep] = useState<1 | 2>(1)
  const [pendingValues, setPendingValues] = useState<CloseSaleInput | null>(null)
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<CloseSaleInput>({
    // z.coerce transforms the input type; react-hook-form uses the parsed output here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(closeSaleSchema) as any,
    defaultValues: { offer_id: '', price_plan_id: '', discount_value: 0, commercial_notes: '' }
  })
  const offerId = watch('offer_id')
  const discount = watch('discount_value') || 0
  const plans = usePricePlans(offerId)
  const selectedOffer = offers.data?.find((offer) => offer.id === offerId)
  const selectedPlan = plans.data?.find((plan) => plan.id === watch('price_plan_id'))
  const netValue = Math.max(0, (selectedPlan?.total_amount ?? 0) - discount)

  useEffect(() => {
    if (open) {
      setStep(1)
      setPendingValues(null)
      reset({ offer_id: '', price_plan_id: '', discount_value: 0, commercial_notes: '' })
    }
  }, [open, reset])

  useEffect(() => {
    if (open && !offerId && lead.course_interest_id && offers.data) {
      const suggested = offers.data.find((offer) => offer.offer_type === 'COURSE' && offer.course_id === lead.course_interest_id)
      if (suggested) setValue('offer_id', suggested.id)
    }
  }, [lead.course_interest_id, offerId, offers.data, open, setValue])

  useEffect(() => { setValue('price_plan_id', '') }, [offerId, setValue])

  const handleStep1Valid = (values: CloseSaleInput) => {
    setPendingValues(values)
    setStep(2)
  }

  const handleConfirm = async () => {
    if (!pendingValues) return
    try {
      const result = await createSale.mutateAsync({ lead_id: lead.id, ...pendingValues })
      toast.success(`Venda ${result.sale_code} criada com sucesso.`)
      onOpenChange(false)
      navigate(`/vendas/${result.sale_id}`)
    } catch (err) { toast.error(offlineAwareMessage(err, 'Não foi possível criar a venda.')) }
  }

  return <Modal open={open} onOpenChange={onOpenChange} title="Fechar venda">
    {step === 1 ? <form onSubmit={handleSubmit(handleStep1Valid)} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Oferta COURSE *</label>
        <Select {...register('offer_id')}>
          <option value="">Selecione a oferta</option>
          {offers.data?.filter((offer) => offer.offer_type === 'COURSE').map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}
        </Select>
        {errors.offer_id && <p className="mt-1 text-xs text-red-600">{errors.offer_id.message}</p>}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Plano de preço *</label>
        <Select {...register('price_plan_id')} disabled={!offerId || plans.isLoading}>
          <option value="">{plans.isLoading ? 'Carregando planos…' : 'Selecione o plano'}</option>
          {plans.data?.map((plan) => <option key={plan.id} value={plan.id}>{formatPlan(plan)}</option>)}
        </Select>
        {errors.price_plan_id && <p className="mt-1 text-xs text-red-600">{errors.price_plan_id.message}</p>}
      </div>
      {selectedPlan && <div className="rounded-md bg-navy-50 p-3 text-sm space-y-1">
        <div className="font-medium">{selectedOffer?.name}</div>
        <div>Forma de pagamento: {paymentLabels[selectedPlan.payment_method]}</div>
        <div>Valor base: {formatCurrency(selectedPlan.total_amount)}</div>
        {selectedPlan.installment_count && <div>Parcelas: {selectedPlan.installment_count}× {selectedPlan.installment_amount != null ? formatCurrency(selectedPlan.installment_amount) : ''}</div>}
      </div>}
      <Input label="Desconto" type="number" min="0" step="0.01" error={errors.discount_value?.message} {...register('discount_value', { valueAsNumber: true })} />
      <div className="rounded-md bg-navy-50 p-3 text-sm">Valor final: <span className="font-bold">{formatCurrency(netValue)}</span></div>
      <label className="block text-sm font-medium text-ink mb-1.5">Observações comerciais</label>
      <Textarea rows={3} {...register('commercial_notes')} />
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit">Revisar venda</Button></div>
    </form> : <div className="space-y-4">
      <div className="space-y-3 text-sm">
        <ReviewRow label="Cliente" value={lead.full_name} />
        <ReviewRow label="Oferta" value={selectedOffer?.name ?? '—'} />
        <ReviewRow label="Plano" value={selectedPlan ? formatPlan(selectedPlan) : '—'} />
        <ReviewRow label="Valor base" value={formatCurrency(selectedPlan?.total_amount ?? 0)} />
        <ReviewRow label="Desconto" value={formatCurrency(pendingValues?.discount_value ?? 0)} />
        <ReviewRow label="Valor final" value={formatCurrency(netValue)} highlight />
        <ReviewRow label="Pagamento" value={selectedPlan ? paymentLabels[selectedPlan.payment_method] : '—'} />
        <ReviewRow label="Parcelas" value={String(selectedPlan?.installment_count ?? (selectedPlan?.pricing_model === 'CASH' ? 1 : '—'))} />
        <ReviewRow label="Vendedor" value={lead.owner_name ?? '—'} />
      </div>
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">Esta ação registrará a venda e encerrará o Lead como ganho.</div>
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setStep(1)}>Voltar</Button><Button type="button" onClick={handleConfirm} loading={createSale.isPending} disabled={createSale.isPending}>Confirmar venda</Button></div>
    </div>}
  </Modal>
}

function formatPlan(plan: { payment_method: CommercialPaymentMethod; pricing_model: string; installment_count: number | null; installment_amount: number | null; total_amount: number }) {
  if (plan.pricing_model === 'CASH') return `À vista — ${formatCurrency(plan.total_amount)}`
  return `${paymentLabels[plan.payment_method]} — ${plan.installment_count ?? '—'}× ${plan.installment_amount != null ? formatCurrency(plan.installment_amount) : ''} — Total ${formatCurrency(plan.total_amount)}`
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className="flex w-full flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2"><span className="shrink-0 text-muted">{label}</span><span className={`min-w-0 text-right break-words ${highlight ? 'text-lg font-bold text-emerald-700' : 'font-medium'}`}>{value}</span></div>
}
