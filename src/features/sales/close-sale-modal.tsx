import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Input, Select, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCreateSaleFromLead } from './sales-hooks'
import { useCrmCourses } from '../crm/crm-hooks'
import { closeSaleSchema, type CloseSaleInput } from './sales-schemas'
import { SALE_PAYMENT_METHODS, SALE_PAYMENT_METHOD_LABELS } from './sales-constants'
import type { CrmLeadDetail } from '../crm/crm-types'
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

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CloseSaleInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(closeSaleSchema) as any,
    defaultValues: {
      course_id: lead.course_interest_id ?? '',
      gross_value: lead.proposed_value ?? lead.estimated_value ?? 0,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1,
      commercial_notes: ''
    }
  })

  useEffect(() => {
    if (open) {
      reset({
        course_id: lead.course_interest_id ?? '',
        gross_value: lead.proposed_value ?? lead.estimated_value ?? 0,
        discount_value: 0,
        payment_method: 'PIX',
        installments: 1,
        commercial_notes: ''
      })
    }
  }, [open, lead, reset])

  const onSubmit = async (values: CloseSaleInput) => {
    try {
      const result = await createSale.mutateAsync({
        lead_id: lead.id,
        course_id: values.course_id,
        gross_value: values.gross_value,
        discount_value: values.discount_value,
        payment_method: values.payment_method,
        installments: values.installments,
        commercial_notes: values.commercial_notes
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            Confirmar venda
          </Button>
        </div>
      </form>
    </Modal>
  )
}
