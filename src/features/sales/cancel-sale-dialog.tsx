import { toast } from 'sonner'
import { Button, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCancelSale } from './sales-hooks'
import { cancelSaleSchema, type CancelSaleInput } from './sales-schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

type Props = {
  saleId: string
  saleCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancelled?: () => void
}

export function CancelSaleDialog({ saleId, saleCode, open, onOpenChange, onCancelled }: Props) {
  const cancelSale = useCancelSale()

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CancelSaleInput>({
    resolver: zodResolver(cancelSaleSchema)
  })

  const onSubmit = async (values: CancelSaleInput) => {
    try {
      await cancelSale.mutateAsync({ saleId, reason: values.cancellation_reason })
      toast.success(`Venda ${saleCode} cancelada.`)
      onOpenChange(false)
      reset()
      onCancelled?.()
    } catch {
      toast.error('Não foi possível cancelar a venda.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Cancelar venda ${saleCode}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted">
          Esta ação não pode ser desfeita. A venda será marcada como cancelada.
        </p>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Motivo do cancelamento *</label>
          <Textarea rows={3} placeholder="Informe o motivo..." {...register('cancellation_reason')} />
          {errors.cancellation_reason && (
            <p className="mt-1 text-xs text-red-600">{errors.cancellation_reason.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button type="submit" variant="danger" loading={isSubmitting} disabled={isSubmitting}>
            Confirmar cancelamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
