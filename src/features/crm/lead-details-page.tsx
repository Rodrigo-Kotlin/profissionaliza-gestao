import { ArrowRightLeft, CalendarDays, CheckCircle2, Clock, Eye, Pencil, Trash2, UserPlus, XCircle, CircleX, Phone, MessageSquare, Mail, Users, RotateCcw, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton, Tabs, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useCrmLeadDetail, useCrmCourses, useUpdateLead, useMoveStage, useCloseLost, useCompleteActivity, useRescheduleActivity, useCreateActivity, useCrmLeadTimeline, useCrmLeadActivities, useCrmPipelineStages } from './crm-hooks'
import { CRM_TEMPERATURE_LABELS, CRM_TEMPERATURE_TONES, CRM_STATUS_LABELS, CRM_STATUS_TONES, CRM_LOST_REASONS, CRM_LOST_REASON_LABELS, CRM_ACTIVITY_TYPE_LABELS, CRM_ACTIVITY_TYPES } from './crm-constants'
import { formatCurrency, formatDueAt } from './crm-utils'
import type { CrmLeadDetail, CrmActivityType, CrmActivityStatus, CrmTimelineEventType } from './crm-types'
import { leadUpdateSchema, type LeadUpdateInput, lostLeadSchema, type LostLeadInput, activityFormSchema, type ActivityFormInput } from './crm-schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const LEAD_TABS = ['Resumo', 'Atividades', 'Histórico', 'Qualificação'] as const

const ACTIVITY_TYPE_ICONS: Record<CrmActivityType, typeof Phone> = {
  CALL: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  MEETING: Users,
  FOLLOW_UP: RotateCcw,
  OTHER: MoreHorizontal
}

const ACTIVITY_STATUS_TONES: Record<CrmActivityStatus, 'warning' | 'success' | 'neutral'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  CANCELED: 'neutral'
}

const ACTIVITY_STATUS_LABELS: Record<CrmActivityStatus, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada'
}

const TIMELINE_ICON_CONFIG: Record<CrmTimelineEventType, { icon: typeof UserPlus; color: string; label: string }> = {
  LEAD_CREATED: { icon: UserPlus, color: 'text-blue-600', label: 'Lead criado' },
  STAGE_CHANGED: { icon: ArrowRightLeft, color: 'text-amber-600', label: 'Etapa alterada' },
  ACTIVITY_CREATED: { icon: CalendarDays, color: 'text-indigo-600', label: 'Atividade criada' },
  ACTIVITY_COMPLETED: { icon: CheckCircle2, color: 'text-green-600', label: 'Atividade concluída' },
  ACTIVITY_RESCHEDULED: { icon: Clock, color: 'text-orange-600', label: 'Atividade reagendada' },
  ACTIVITY_CANCELED: { icon: XCircle, color: 'text-red-500', label: 'Atividade cancelada' },
  LEAD_LOST: { icon: CircleX, color: 'text-red-600', label: 'Lead perdido' }
}

export function LeadDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const leadId = id ?? ''
  const [tab, setTab] = useState<string>('Resumo')
  const [editOpen, setEditOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  const detail = useCrmLeadDetail(leadId)
  const canEdit = can(permissions, PERMISSIONS.CRM_EDIT)
  const canMoveStage = can(permissions, PERMISSIONS.CRM_MOVE_STAGE)
  const canCloseLost = can(permissions, PERMISSIONS.CRM_CLOSE_LOST)
  const canManageActivity = can(permissions, PERMISSIONS.CRM_ACTIVITIES_MANAGE)

  if (detail.isLoading) return <PageSkeleton />

  if (detail.isError || !detail.data) {
    return (
      <Card>
        <EmptyState icon={Eye} title="Lead não encontrado" description="Verifique o vínculo ou tente novamente." />
      </Card>
    )
  }

  const lead = detail.data

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Lead">
        <Button variant="secondary" onClick={() => navigate('/crm/leads')}>Voltar</Button>
        {canEdit && lead.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Editar
          </Button>
        )}
        {canMoveStage && lead.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setMoveOpen(true)}>
            <ArrowRightLeft className="size-4" /> Mover etapa
          </Button>
        )}
        {canManageActivity && lead.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setActivityOpen(true)}>
            <CalendarDays className="size-4" /> Nova atividade
          </Button>
        )}
        {canCloseLost && lead.status === 'OPEN' && (
          <Button variant="danger" onClick={() => setLostOpen(true)}>
            <Trash2 className="size-4" /> Marcar como perdido
          </Button>
        )}
      </PageHeader>

      <LeadHeaderCard lead={lead} />

      <Tabs items={[...LEAD_TABS]} value={tab} onChange={setTab} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {tab === 'Resumo' && <ResumoTab lead={lead} />}
          {tab === 'Atividades' && <AtividadesTab leadId={leadId} lead={lead} />}
          {tab === 'Histórico' && <HistoricoTab leadId={leadId} lead={lead} />}
          {tab === 'Qualificação' && <QualificacaoTab leadId={leadId} lead={lead} canEdit={canEdit} />}
        </div>

        <div className="hidden lg:block">
          {lead.status === 'OPEN' && lead.next_activity && <NextActivityCard activity={lead.next_activity} leadId={leadId} />}
        </div>
      </div>

      <Modal open={editOpen} onOpenChange={setEditOpen} title="Editar lead">
        <EditLeadForm lead={lead} onDone={() => setEditOpen(false)} canMoveStage={canMoveStage} />
      </Modal>

      <Modal open={moveOpen} onOpenChange={setMoveOpen} title="Mover etapa">
        <MoveStageForm lead={lead} onDone={() => setMoveOpen(false)} />
      </Modal>

      <Modal open={lostOpen} onOpenChange={setLostOpen} title="Marcar lead como perdido">
        <LostLeadForm leadId={leadId} onDone={() => { setLostOpen(false); navigate('/crm/leads') }} />
      </Modal>

      <Modal open={activityOpen} onOpenChange={setActivityOpen} title="Nova atividade">
        <NewActivityForm leadId={leadId} onDone={() => setActivityOpen(false)} />
      </Modal>
    </div>
  )
}

function LeadHeaderCard({ lead }: { lead: CrmLeadDetail }) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-balance">{lead.full_name}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{lead.lead_code}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant={CRM_STATUS_TONES[lead.status]}>{CRM_STATUS_LABELS[lead.status]}</Badge>
            <Badge variant={lead.temperature ? CRM_TEMPERATURE_TONES[lead.temperature] : 'neutral'}>
              {lead.temperature ? CRM_TEMPERATURE_LABELS[lead.temperature] : 'Sem temperatura'}
            </Badge>
            {lead.source_name && <Badge>{lead.source_name}</Badge>}
            <span className="text-sm text-muted">{lead.stage_name}</span>
            {lead.course_name && <span className="text-sm text-muted">{lead.course_name}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm text-muted">
          {lead.owner_name && <span>Responsável: {lead.owner_name}</span>}
          <span>{lead.days_in_pipeline} dias no funil</span>
          <span>Criado em {new Date(lead.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </Card>
  )
}

function ResumoTab({ lead }: { lead: CrmLeadDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Contato</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Telefone" value={lead.phone ?? 'Não informado'} />
          <Row label="WhatsApp" value={lead.whatsapp ?? 'Não informado'} />
          <Row label="E-mail" value={lead.email ?? 'Não informado'} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Curso e origem</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Curso" value={lead.course_name ?? 'Não informado'} />
          <Row label="Origem" value={lead.source_name ?? 'Não informado'} />
          <Row label="Detalhe origem" value={lead.source_detail ?? 'Não informado'} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Pipeline</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Etapa" value={lead.stage_name} />
          <Row label="Temperatura" value={lead.temperature ? CRM_TEMPERATURE_LABELS[lead.temperature] : 'Não definida'} />
          <Row label="Status" value={CRM_STATUS_LABELS[lead.status]} />
          <Row label="Dias no funil" value={String(lead.days_in_pipeline)} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Valores</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Valor estimado" value={formatCurrency(lead.estimated_value)} />
          <Row label="Valor proposto" value={formatCurrency(lead.proposed_value)} />
        </dl>
      </Card>
      {lead.commercial_notes && (
        <Card className="p-5 md:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Observações</h3>
          <p className="whitespace-pre-wrap text-sm text-muted">{lead.commercial_notes}</p>
        </Card>
      )}
    </div>
  )
}

function AtividadesTab({ leadId, lead }: { leadId: string; lead: CrmLeadDetail }) {
  const activitiesQuery = useCrmLeadActivities(leadId)
  const completeActivity = useCompleteActivity()
  const rescheduleActivity = useRescheduleActivity()
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'COMPLETED' | 'CANCELED'>('all')
  const [outcomeActivityId, setOutcomeActivityId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState('')
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')

  if (activitiesQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  if (activitiesQuery.isError) {
    return (
      <Card className="p-5">
        <EmptyState icon={CalendarDays} title="Erro ao carregar atividades" description="Tente novamente mais tarde." />
      </Card>
    )
  }

  const allActivities = activitiesQuery.data?.data ?? []
  const filtered = filter === 'all' ? allActivities : allActivities.filter((a) => a.status === filter)

  const handleComplete = async (activityId: string) => {
    try {
      await completeActivity.mutateAsync({ activityId, outcome: outcome || undefined, leadId })
      toast.success('Atividade concluída.')
      setOutcomeActivityId(null)
      setOutcome('')
    } catch {
      toast.error('Não foi possível concluir a atividade.')
    }
  }

  const handleReschedule = async (activityId: string) => {
    if (!newDate) return
    try {
      await rescheduleActivity.mutateAsync({ activityId, newDueAt: newDate, leadId })
      toast.success('Atividade reagendada.')
      setRescheduleId(null)
      setNewDate('')
    } catch {
      toast.error('Não foi possível reagendar.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([['all', 'Todas'], ['PENDING', 'Pendentes'], ['COMPLETED', 'Concluídas'], ['CANCELED', 'Canceladas']] as const).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? 'primary' : 'ghost'}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhuma atividade" description="Crie uma atividade para este lead." />
      ) : (
        filtered.map((act) => {
          const IconComp = ACTIVITY_TYPE_ICONS[act.type]
          const canAct = lead.status === 'OPEN' && act.status === 'PENDING'
          return (
            <Card key={act.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <IconComp className="size-4 text-muted" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{act.title}</p>
                      <Badge variant={ACTIVITY_STATUS_TONES[act.status]}>{ACTIVITY_STATUS_LABELS[act.status]}</Badge>
                    </div>
                    {act.description && <p className="mt-1 text-xs text-muted">{act.description}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{CRM_ACTIVITY_TYPE_LABELS[act.type]}</span>
                      <span>·</span>
                      <span>{formatDueAt(act.due_at)}</span>
                      {act.completed_at && (
                        <>
                          <span>·</span>
                          <span>Concluída em {new Date(act.completed_at).toLocaleDateString('pt-BR')}</span>
                        </>
                      )}
                      {act.owner_name && (
                        <>
                          <span>·</span>
                          <span>{act.owner_name}</span>
                        </>
                      )}
                    </div>
                    {act.status === 'COMPLETED' && act.outcome && (
                      <p className="mt-1.5 text-xs text-muted italic">Resultado: {act.outcome}</p>
                    )}
                  </div>
                </div>
                {canAct && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOutcomeActivityId(act.id)}>
                      <CheckCircle2 className="size-4" /> Concluir
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRescheduleId(act.id)}>
                      <Clock className="size-4" /> Reagendar
                    </Button>
                  </div>
                )}
              </div>

              {outcomeActivityId === act.id && (
                <div className="mt-3 flex gap-2">
                  <Input placeholder="Resultado (opcional)" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
                  <Button type="button" size="sm" onClick={() => handleComplete(act.id)} loading={completeActivity.isPending} disabled={completeActivity.isPending}>OK</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setOutcomeActivityId(null); setOutcome('') }}>Cancelar</Button>
                </div>
              )}

              {rescheduleId === act.id && (
                <div className="mt-3 flex gap-2">
                  <Input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  <Button type="button" size="sm" onClick={() => handleReschedule(act.id)} loading={rescheduleActivity.isPending} disabled={rescheduleActivity.isPending}>Reagendar</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setRescheduleId(null); setNewDate('') }}>Cancelar</Button>
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

function HistoricoTab({ leadId }: { leadId: string; lead: CrmLeadDetail }) {
  const timeline = useCrmLeadTimeline(leadId)

  if (timeline.isLoading) {
    return (
      <Card className="p-5 sm:p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (timeline.isError) {
    return (
      <Card className="p-5 sm:p-6">
        <EmptyState icon={Clock} title="Erro ao carregar histórico" description="Tente novamente mais tarde." />
      </Card>
    )
  }

  const events = timeline.data?.data ?? []

  if (events.length === 0) {
    return (
      <Card className="p-5 sm:p-6">
        <EmptyState icon={Clock} title="Nenhum evento" description="Ainda não há eventos neste timeline." />
      </Card>
    )
  }

  return (
    <Card className="p-5 sm:p-6">
      <ol className="space-y-1 border-l-2 border-line pl-0">
        {events.map((evt) => {
          const config = TIMELINE_ICON_CONFIG[evt.event_type]
          const Icon = config.icon
          const meta = evt.metadata as Record<string, unknown>
          let description = evt.description
          if (evt.event_type === 'STAGE_CHANGED' && meta.old_stage_name && meta.new_stage_name) {
            description = `${meta.old_stage_name} → ${meta.new_stage_name}`
          }
          return (
            <li key={evt.id} className="relative pl-6">
              <span className="absolute -left-[9px] top-1 size-4 rounded-full border-2 border-line bg-white flex items-center justify-center">
                <Icon className={`size-2.5 ${config.color}`} />
              </span>
              <div className="pb-5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{config.label}</p>
                  {evt.title && evt.event_type !== 'LEAD_CREATED' && evt.event_type !== 'STAGE_CHANGED' && (
                    <span className="text-sm text-muted">— {evt.title}</span>
                  )}
                </div>
                {description && (
                  <p className="mt-0.5 text-xs text-muted">{description}</p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span>{new Date(evt.occurred_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {evt.actor_name && (
                    <>
                      <span>·</span>
                      <span>{evt.actor_name}</span>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function QualificacaoTab({ leadId, lead, canEdit }: { leadId: string; lead: CrmLeadDetail; canEdit: boolean }) {
  const updateLead = useUpdateLead()
  const { register, handleSubmit, formState: { isSubmitting, isDirty } } = useForm<LeadUpdateInput>({
    resolver: zodResolver(leadUpdateSchema),
    defaultValues: {
      qualification_start_period: lead.qualification_start_period ?? '',
      preferred_shift: lead.preferred_shift ?? '',
      preferred_modality: lead.preferred_modality ?? '',
      budget_notes: lead.budget_notes ?? '',
      decision_maker: lead.decision_maker ?? '',
      estimated_value: lead.estimated_value ?? undefined,
      proposed_value: lead.proposed_value ?? undefined,
      commercial_notes: lead.commercial_notes ?? ''
    }
  })

  const onSubmit = async (values: LeadUpdateInput) => {
    try {
      await updateLead.mutateAsync({ leadId, input: values as Record<string, unknown> })
      toast.success('Qualificação atualizada.')
    } catch {
      toast.error('Não foi possível salvar.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Qualificação do lead</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Período desejado" placeholder="Ex: Janeiro 2025" disabled={!canEdit} {...register('qualification_start_period')} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Turno preferido</label>
            <Select disabled={!canEdit} {...register('preferred_shift')}>
              <option value="">Selecione</option>
              <option value="MORNING">Manhã</option>
              <option value="AFTERNOON">Tarde</option>
              <option value="EVENING">Noite</option>
              <option value="FLEXIBLE">Flexível</option>
            </Select>
          </div>
          <Input label="Modalidade" disabled={!canEdit} {...register('preferred_modality')} />
          <Input label="Decisor" disabled={!canEdit} {...register('decision_maker')} />
          <Input label="Valor estimado" type="number" step="0.01" disabled={!canEdit} {...register('estimated_value', { valueAsNumber: true })} />
          <Input label="Valor proposto" type="number" step="0.01" disabled={!canEdit} {...register('proposed_value', { valueAsNumber: true })} />
        </div>
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-ink mb-1.5">Notas de orçamento</label>
          <Textarea rows={2} disabled={!canEdit} {...register('budget_notes')} />
          <label className="block text-sm font-medium text-ink mb-1.5">Notas comerciais</label>
          <Textarea rows={3} disabled={!canEdit} {...register('commercial_notes')} />
        </div>
        {canEdit && (
          <div className="mt-4 flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting || !isDirty}>Salvar</Button>
          </div>
        )}
      </Card>
    </form>
  )
}

function NextActivityCard({ activity, leadId }: { activity: CrmLeadDetail['next_activity']; leadId: string }) {
  const completeActivity = useCompleteActivity()

  if (!activity) return null

  const handleComplete = async () => {
    try {
      await completeActivity.mutateAsync({ activityId: activity.id, leadId })
      toast.success('Atividade concluída.')
    } catch {
      toast.error('Não foi possível concluir a atividade.')
    }
  }

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">Próxima atividade</h3>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{activity.title}</p>
        <p className="text-xs text-muted">{CRM_ACTIVITY_TYPE_LABELS[activity.type]}</p>
        <p className={`text-xs font-medium ${activity.is_overdue ? 'text-red-600' : 'text-muted'}`}>
          {formatDueAt(activity.due_at)}
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-2 w-full"
          onClick={handleComplete}
          loading={completeActivity.isPending}
          disabled={completeActivity.isPending}
        >
          <CheckCircle2 className="size-4" /> Concluir
        </Button>
      </div>
    </Card>
  )
}

function EditLeadForm({ lead, onDone, canMoveStage }: { lead: CrmLeadDetail; onDone: () => void; canMoveStage: boolean }) {
  const updateLead = useUpdateLead()
  const courses = useCrmCourses('ACTIVE')
  const stagesQuery = useCrmPipelineStages()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LeadUpdateInput>({
    resolver: zodResolver(leadUpdateSchema),
    defaultValues: {
      source_id: lead.source_id ?? '',
      course_interest_id: lead.course_interest_id ?? '',
      temperature: lead.temperature ?? undefined,
      stage_id: lead.stage_id ?? '',
      commercial_notes: lead.commercial_notes ?? ''
    }
  })

  const onSubmit = async (values: LeadUpdateInput) => {
    try {
      await updateLead.mutateAsync({ leadId: lead.id, input: values as Record<string, unknown> })
      toast.success('Lead atualizado.')
      onDone()
    } catch {
      toast.error('Não foi possível salvar.')
    }
  }

  const stages = stagesQuery.data ?? []

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Temperatura</label>
        <div className="flex gap-4">
          {(['HOT', 'WARM', 'COLD'] as const).map((temp) => (
            <label key={temp} className="flex items-center gap-2 text-sm">
              <input type="radio" value={temp} {...register('temperature')} className="size-4 accent-navy" />
              {CRM_TEMPERATURE_LABELS[temp]}
            </label>
          ))}
        </div>
        {errors.temperature && <p className="mt-1 text-xs text-red-600">{errors.temperature.message}</p>}
      </div>

      {canMoveStage && lead.status === 'OPEN' ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Etapa</label>
          <Select {...register('stage_id')}>
            <option value="">Selecione</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.probability != null ? ` (${s.probability}%)` : ''}</option>
            ))}
          </Select>
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Etapa</label>
          <Input value={lead.stage_name} disabled />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Curso de interesse</label>
        <Select {...register('course_interest_id')}>
          <option value="">Selecione</option>
          {courses.data?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      <label className="block text-sm font-medium text-ink mb-1.5">Observações</label>
      <Textarea rows={3} {...register('commercial_notes')} />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>Salvar</Button>
      </div>
    </form>
  )
}

function MoveStageForm({ lead, onDone }: { lead: CrmLeadDetail; onDone: () => void }) {
  const moveStage = useMoveStage()
  const stagesQuery = useCrmPipelineStages()
  const [stageId, setStageId] = useState(lead.stage_id)
  const [reason, setReason] = useState('')

  const stages = stagesQuery.data ?? []

  const handleMove = async () => {
    if (!stageId || stageId === lead.stage_id) return
    try {
      await moveStage.mutateAsync({ leadId: lead.id, stageId, reason: reason || undefined })
      toast.success('Etapa atualizada.')
      onDone()
    } catch {
      toast.error('Não foi possível mover o lead.')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Nova etapa</label>
        <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.probability != null ? ` (${s.probability}%)` : ''}</option>
          ))}
        </Select>
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">Motivo da movimentação (opcional)</label>
      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button onClick={handleMove} loading={moveStage.isPending} disabled={moveStage.isPending || stageId === lead.stage_id}>
          Mover etapa
        </Button>
      </div>
    </div>
  )
}

function LostLeadForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const closeLost = useCloseLost()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LostLeadInput>({
    resolver: zodResolver(lostLeadSchema)
  })

  const onSubmit = async (values: LostLeadInput) => {
    try {
      await closeLost.mutateAsync({ leadId, reasonId: values.lost_reason_id, notes: values.lost_notes })
      toast.success('Lead marcado como perdido.')
      onDone()
    } catch {
      toast.error('Não foi possível registrar.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Motivo da perda *</label>
        <Select {...register('lost_reason_id')}>
          <option value="">Selecione o motivo</option>
          {CRM_LOST_REASONS.filter((r) => r.is_active).map((r) => (
            <option key={r.code} value={r.code}>{CRM_LOST_REASON_LABELS[r.code]}</option>
          ))}
        </Select>
        {errors.lost_reason_id && <p className="mt-1 text-xs text-red-600">{errors.lost_reason_id.message}</p>}
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">Observações (opcional)</label>
      <Textarea rows={3} {...register('lost_notes')} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="danger" loading={isSubmitting} disabled={isSubmitting}>
          Confirmar perda
        </Button>
      </div>
    </form>
  )
}

function NewActivityForm({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const createActivity = useCreateActivity()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ActivityFormInput>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: { type: 'CALL' }
  })

  const onSubmit = async (values: ActivityFormInput) => {
    try {
      await createActivity.mutateAsync({
        lead_id: leadId,
        type: values.type,
        title: values.title,
        description: values.description,
        due_at: values.due_at
      })
      toast.success('Atividade criada.')
      onDone()
    } catch {
      toast.error('Não foi possível criar a atividade.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Título *" error={errors.title?.message} {...register('title')} placeholder="Ex: Ligação de follow-up" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Tipo *</label>
          <Select {...register('type')}>
            {CRM_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>{CRM_ACTIVITY_TYPE_LABELS[type]}</option>
            ))}
          </Select>
        </div>
        <Input label="Data e hora *" type="datetime-local" error={errors.due_at?.message} {...register('due_at')} />
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">Descrição (opcional)</label>
      <Textarea rows={2} {...register('description')} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>Criar atividade</Button>
      </div>
    </form>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando lead">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-36" />
      <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
    </div>
  )
}
