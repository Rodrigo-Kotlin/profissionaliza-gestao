import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, CirclePause, Play, Ban, GraduationCap } from 'lucide-react'
import { Button, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { can, PERMISSIONS } from '@/lib/rbac'
import { offlineAwareMessage } from '@/lib/offline'
import { useAuth } from '@/features/auth/auth-context'
import {
  useActivateEnrollment,
  useCancelEnrollment,
  useCompleteEnrollment,
  usePauseEnrollment,
  useResumeEnrollment
} from './enrollments-hooks'
import type { EnrollmentAction, EnrollmentRecord } from './enrollment-types'

const ACTIONS: Record<EnrollmentAction, { title: string; description: string; submit: string; reason: boolean }> = {
  activate: { title: 'Ativar matrícula', description: 'A matrícula passará a representar uma formação em andamento.', submit: 'Ativar matrícula', reason: false },
  pause: { title: 'Pausar matrícula', description: 'Informe o motivo operacional da pausa.', submit: 'Pausar matrícula', reason: true },
  resume: { title: 'Retomar matrícula', description: 'A matrícula voltará ao estado ativa.', submit: 'Retomar matrícula', reason: false },
  complete: { title: 'Concluir matrícula', description: 'Confirme que a formação foi concluída.', submit: 'Concluir matrícula', reason: false },
  cancel: { title: 'Cancelar matrícula', description: 'O cancelamento é terminal e exige um motivo.', submit: 'Cancelar matrícula', reason: true }
}

export function EnrollmentActions({ enrollment }: { enrollment: EnrollmentRecord }) {
  const { permissions } = useAuth()
  const [action, setAction] = useState<EnrollmentAction | null>(null)
  const [reason, setReason] = useState('')
  const activate = useActivateEnrollment()
  const pause = usePauseEnrollment()
  const resume = useResumeEnrollment()
  const complete = useCompleteEnrollment()
  const cancel = useCancelEnrollment()

  const available: EnrollmentAction[] = enrollment.status === 'PENDING'
    ? ['activate', 'cancel']
    : enrollment.status === 'ACTIVE'
      ? ['pause', 'complete', 'cancel']
      : enrollment.status === 'PAUSED' ? ['resume', 'cancel'] : []

  const allowed: EnrollmentAction[] = available.filter((item) => {
    const permission = {
      activate: PERMISSIONS.ENROLLMENTS_ACTIVATE,
      pause: PERMISSIONS.ENROLLMENTS_PAUSE,
      resume: PERMISSIONS.ENROLLMENTS_RESUME,
      complete: PERMISSIONS.ENROLLMENTS_COMPLETE,
      cancel: PERMISSIONS.ENROLLMENTS_CANCEL
    }[item]
    return can(permissions, permission)
  })

  const submit = async () => {
    if (!action) return
    if (ACTIONS[action].reason && !reason.trim()) return
    try {
      if (action === 'activate') await activate.mutateAsync(enrollment.id)
      if (action === 'pause') await pause.mutateAsync({ id: enrollment.id, reason: reason.trim() })
      if (action === 'resume') await resume.mutateAsync(enrollment.id)
      if (action === 'complete') await complete.mutateAsync(enrollment.id)
      if (action === 'cancel') await cancel.mutateAsync({ id: enrollment.id, reason: reason.trim() })
      toast.success(`${ACTIONS[action].submit} realizada.`)
      setAction(null)
      setReason('')
    } catch (error) {
      toast.error(offlineAwareMessage(error, `Não foi possível ${ACTIONS[action].submit.toLowerCase()}.`))
    }
  }

  if (!allowed.length) return null
  const current = action ? ACTIONS[action] : null
  const pending = activate.isPending || pause.isPending || resume.isPending || complete.isPending || cancel.isPending

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowed.map((item) => {
          const icon = { activate: GraduationCap, pause: CirclePause, resume: Play, complete: CheckCircle2, cancel: Ban }[item]
          const Icon = icon
          return <Button key={item} variant={item === 'cancel' ? 'danger' : item === 'complete' ? 'primary' : 'secondary'} onClick={() => setAction(item)}><Icon className="size-4" />{ACTIONS[item].submit}</Button>
        })}
      </div>
      <Modal open={Boolean(action)} onOpenChange={(open) => { if (!open) { setAction(null); setReason('') } }} title={current?.title ?? 'Ação da matrícula'}>
        {current && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{current.description}</p>
            {current.reason && (
              <div>
                <label htmlFor="enrollment-action-reason" className="mb-1.5 block text-sm font-medium text-ink">Motivo *</label>
                <Textarea id="enrollment-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Descreva o motivo" autoFocus />
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setAction(null)}>Voltar</Button>
              <Button variant={action === 'cancel' ? 'danger' : 'primary'} loading={pending} disabled={current.reason && !reason.trim()} onClick={submit}>{current.submit}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
