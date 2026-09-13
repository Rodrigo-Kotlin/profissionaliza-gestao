import { toast } from 'sonner'
import { Button, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCancelContract } from './contracts-hooks'
import { cancelContractSchema, type CancelContractInput } from './contracts-schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

type Props = {
  contractId: string
  contractCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCanceled?: () => void
}

export function CancelContractDialog({ contractId, contractCode, open, onOpenChange, onCanceled }: Props) {
  const cancel = useCancelContract()

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CancelContractInput>({
    resolver: zodResolver(cancelContractSchema)
  })

  const onSubmit = async (values: CancelContractInput) => {
    try {
      const result = await cancel.mutateAsync({ contract_id: contractId, cancellation_reason: values.cancellation_reason })
      toast.success(`Contrato ${result.contract_code} cancelado.`)
      onOpenChange(false)
      reset()
      onCanceled?.()
    } catch {
      toast.error('Não foi possível cancelar o contrato.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Cancelar contrato ${contractCode}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted">
          Esta ação não pode ser desfeita. A venda e o aluno não são afetados pelo cancelamento do contrato.
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
          <Button type="submit" variant="danger" loading={cancel.isPending} disabled={cancel.isPending}>
            Confirmar cancelamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}