import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Badge, Button, Select, Textarea } from '@/components/ui/core'
import { STUDENT_STATUSES, STUDENT_STATUS_LABELS } from '@/lib/rbac'
import { changeStatusSchema, type ChangeStatusValues } from './students-schemas'
import { getNextStatuses } from './students-utils'

const statusLabel = (status: string): string =>
  (STUDENT_STATUS_LABELS as Record<string, string>)[status] ?? status

export function ChangeStatusForm({
  currentStatus,
  onDone,
  onCancel
}: {
  currentStatus: string
  onDone: (values: ChangeStatusValues) => Promise<void>
  onCancel?: () => void
}) {
  const nextStatuses = getNextStatuses(currentStatus)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ChangeStatusValues>({
    resolver: zodResolver(changeStatusSchema),
    defaultValues: { new_status: '', reason: '' }
  })
  const selected = watch('new_status')

  const onSubmit = async (values: ChangeStatusValues) => {
    try {
      await onDone(values)
      toast.success('Status do aluno atualizado.')
    } catch (err) {
      toast.error(err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Não foi possível alterar o status.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs text-muted">Status atual</p>
          <Badge variant={currentStatus === 'ATIVO' ? 'success' : currentStatus === 'CANCELADO' ? 'danger' : 'warning'}>{statusLabel(currentStatus)}</Badge>
        </div>
        <ArrowRightLeft className="size-5 text-muted" />
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="new-status">Novo status *</label>
          <Select id="new-status" {...register('new_status')}>
            <option value="">Selecione...</option>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
            {nextStatuses.length === 0 && (
              STUDENT_STATUSES.filter((s) => s !== currentStatus).map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))
            )}
          </Select>
          {errors.new_status && <p className="mt-1 text-xs text-red-600">{errors.new_status.message}</p>}
        </div>
      </div>
      {(selected === 'INATIVO' || selected === 'CANCELADO' || selected === 'CONCLUIDO') && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="reason">Motivo *</label>
          <Textarea id="reason" rows={3} placeholder="Descreva o motivo da alteração" {...register('reason')} />
          {errors.reason && <p className="text-xs text-red-600">{errors.reason.message}</p>}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Confirmar alteração'}
        </Button>
      </div>
    </form>
  )
}