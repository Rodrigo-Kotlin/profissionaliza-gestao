import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Filter, Mail, MessageSquare, Phone, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { useCrmAgenda, useCompleteActivity, useRescheduleActivity } from './crm-hooks'
import { CRM_ACTIVITY_TYPE_LABELS, CRM_ACTIVITY_TYPES } from './crm-constants'
import { formatDueAt } from './crm-utils'
import type { CrmActivity, CrmActivityType } from './crm-types'
import { toast } from 'sonner'

const ACTIVITY_ICONS: Record<CrmActivityType, typeof Phone> = {
  CALL: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  MEETING: Video,
  FOLLOW_UP: Clock,
  OTHER: CalendarDays
}

export function ActivitiesPage() {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState('')
  const agenda = useCrmAgenda()

  const activities = useMemo(() => {
    if (!agenda.data?.data) return []
    let list = agenda.data.data
    if (typeFilter) {
      list = list.filter((a) => a.type === typeFilter)
    }
    return list
  }, [agenda.data, typeFilter])

  const pending = useMemo(() => activities.filter((a) => a.status === 'PENDING'), [activities])
  const overdue = useMemo(() => pending.filter((a) => a.is_overdue), [pending])
  const upcoming = useMemo(() => pending.filter((a) => !a.is_overdue), [pending])
  const completed = useMemo(() => activities.filter((a) => a.status === 'COMPLETED'), [activities])

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Atividades" description="Acompanhe as atividades do time comercial.">
        <Button onClick={() => navigate('/crm/leads')}>
          <CalendarDays className="size-4" /> Ver pipeline
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Filter className="size-4 text-muted" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            {CRM_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>{CRM_ACTIVITY_TYPE_LABELS[type]}</option>
            ))}
          </Select>
          <span className="text-sm text-muted">
            {activities.length} atividade{activities.length !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      {agenda.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : agenda.isError ? (
        <EmptyState icon={AlertTriangle} title="Erro ao carregar agenda" description="Verifique sua conexão e tente novamente." />
      ) : activities.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhuma atividade" description="Não há atividades pendentes ou concluídas." />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="size-4" /> Atrasadas ({overdue.length})
              </h2>
              <div className="space-y-2">
                {overdue.map((act) => (
                  <ActivityCard key={act.id} activity={act} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
                <Clock className="size-4" /> Próximas ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map((act) => (
                  <ActivityCard key={act.id} activity={act} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700">
                <CheckCircle2 className="size-4" /> Concluídas ({completed.length})
              </h2>
              <div className="space-y-2">
                {completed.map((act) => (
                  <ActivityCard key={act.id} activity={act} showComplete={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function ActivityCard({ activity, showComplete = true }: { activity: CrmActivity; showComplete?: boolean }) {
  const navigate = useNavigate()
  const completeActivity = useCompleteActivity()
  const rescheduleActivity = useRescheduleActivity()
  const [outcome, setOutcome] = useState('')
  const [showOutcome, setShowOutcome] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState('')

  const Icon = ACTIVITY_ICONS[activity.type] ?? CalendarDays

  const handleComplete = async () => {
    try {
      await completeActivity.mutateAsync({ activityId: activity.id, outcome: outcome || undefined })
      toast.success('Atividade concluída.')
      setShowOutcome(false)
      setOutcome('')
    } catch {
      toast.error('Não foi possível concluir.')
    }
  }

  const handleReschedule = async () => {
    if (!newDate) return
    try {
      await rescheduleActivity.mutateAsync({ activityId: activity.id, newDueAt: newDate })
      toast.success('Atividade reagendada.')
      setShowReschedule(false)
      setNewDate('')
    } catch {
      toast.error('Não foi possível reagendar.')
    }
  }

  return (
    <Card className={`p-4 ${activity.is_overdue ? 'border-red-200 bg-red-50/50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy-50">
          <Icon className="size-5 text-navy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activity.title}</p>
              <button
                className="text-xs text-navy hover:underline"
                onClick={() => navigate(`/crm/leads/${activity.lead_id}`)}
              >
                {activity.lead_code} · {activity.lead_name}
              </button>
            </div>
            {activity.is_overdue && <Badge variant="danger">Atrasada</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">
            {CRM_ACTIVITY_TYPE_LABELS[activity.type]} · {formatDueAt(activity.due_at)}
            {activity.owner_name && ` · ${activity.owner_name}`}
          </p>

          {showComplete && activity.status === 'PENDING' && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowOutcome(true)}>
                <CheckCircle2 className="size-3.5" /> Concluir
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowReschedule(true)}>
                <Clock className="size-3.5" /> Reagendar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => navigate(`/crm/leads/${activity.lead_id}`)}>
                Ver lead
              </Button>
            </div>
          )}

          {showOutcome && (
            <div className="mt-3 flex gap-2">
              <Input placeholder="Resultado (opcional)" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="max-w-xs" />
              <Button type="button" size="sm" onClick={handleComplete} loading={completeActivity.isPending} disabled={completeActivity.isPending}>OK</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowOutcome(false); setOutcome('') }}>Cancelar</Button>
            </div>
          )}

          {showReschedule && (
            <div className="mt-3 flex gap-2">
              <Input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="max-w-xs" />
              <Button type="button" size="sm" onClick={handleReschedule} loading={rescheduleActivity.isPending} disabled={rescheduleActivity.isPending}>Reagendar</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowReschedule(false); setNewDate('') }}>Cancelar</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
