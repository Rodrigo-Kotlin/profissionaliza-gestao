import { Clock, AlertTriangle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Avatar, Badge, Card, EmptyState, Select, Skeleton } from '@/components/ui/core'
import { Tooltip } from '@/components/ui/overlays'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { crmKeys, useCrmPipeline, useMoveStage } from './crm-hooks'
import { CRM_TEMPERATURE_LABELS, CRM_TEMPERATURE_TONES } from './crm-constants'
import type { CrmLeadCard, CrmPipelineColumn, CrmPipelineResponse } from './crm-types'

export function CrmPipeline() {
  const { data, isLoading, isError } = useCrmPipeline()
  const { permissions } = useAuth()
  const queryClient = useQueryClient()
  const moveStage = useMoveStage()

  const [mobileStage, setMobileStage] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)

  const canMoveStage = can(permissions, PERMISSIONS.CRM_MOVE_STAGE)

  const columns = useMemo(() => data?.columns ?? [], [data?.columns])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const activeLead = useMemo(() => {
    if (!activeId || !columns.length) return null
    for (const col of columns) {
      const found = col.leads.find((l) => l.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, columns])

  const activeStageName = useMemo(() => {
    if (!activeId || !columns.length) return ''
    for (const col of columns) {
      if (col.leads.some((l) => l.id === activeId)) return col.stage_name
    }
    return ''
  }, [activeId, columns])

  const findStageForLead = useCallback(
    (leadId: string) => {
      for (const col of columns) {
        if (col.leads.some((l) => l.id === leadId)) return col.stage_id
      }
      return ''
    },
    [columns],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      if (!over) return

      const leadId = String(active.id)
      const targetStageId = String(over.id)
      const sourceStageId = findStageForLead(leadId)

      if (!sourceStageId || sourceStageId === targetStageId) return
      if (movingLeadId) return

      const snapshot = queryClient.getQueryData<CrmPipelineResponse>(crmKeys.pipeline())

      queryClient.setQueryData<CrmPipelineResponse>(crmKeys.pipeline(), (old) => {
        if (!old) return old
        let movedLead: CrmLeadCard | undefined
        const newColumns = old.columns.map((col) => {
          if (col.stage_id === sourceStageId) {
            movedLead = col.leads.find((l) => l.id === leadId)
            return { ...col, leads: col.leads.filter((l) => l.id !== leadId), total_count: col.total_count - 1 }
          }
          return col
        })
        if (!movedLead) return old
        return {
          columns: newColumns.map((col) => {
            if (col.stage_id === targetStageId) {
              return { ...col, leads: [...col.leads, movedLead!], total_count: col.total_count + 1 }
            }
            return col
          }),
        }
      })

      setMovingLeadId(leadId)
      try {
        await moveStage.mutateAsync({ leadId, stageId: targetStageId, reason: 'Movido pelo Kanban' })
      } catch (err: unknown) {
        queryClient.setQueryData<CrmPipelineResponse>(crmKeys.pipeline(), snapshot)
        const code = (err as { code?: string | number })?.code
        const message = (err as { message?: string })?.message ?? ''
        if (code === 22023 && message.includes('course')) {
          toast.error('Informe o curso de interesse antes de qualificar o Lead.')
        } else if (code === 42501) {
          toast.error('Você não possui permissão para mover este Lead.')
        } else {
          toast.error('Não foi possível mover o lead.')
        }
      } finally {
        setMovingLeadId(null)
      }
    },
    [findStageForLead, movingLeadId, moveStage, queryClient],
  )

  const handleMobileStageChange = useCallback(
    async (leadId: string, targetStageId: string) => {
      const sourceStageId = findStageForLead(leadId)
      if (!sourceStageId || sourceStageId === targetStageId) return

      const snapshot = queryClient.getQueryData<CrmPipelineResponse>(crmKeys.pipeline())

      queryClient.setQueryData<CrmPipelineResponse>(crmKeys.pipeline(), (old) => {
        if (!old) return old
        let movedLead: CrmLeadCard | undefined
        const newColumns = old.columns.map((col) => {
          if (col.stage_id === sourceStageId) {
            movedLead = col.leads.find((l) => l.id === leadId)
            return { ...col, leads: col.leads.filter((l) => l.id !== leadId), total_count: col.total_count - 1 }
          }
          return col
        })
        if (!movedLead) return old
        return {
          columns: newColumns.map((col) => {
            if (col.stage_id === targetStageId) {
              return { ...col, leads: [...col.leads, movedLead!], total_count: col.total_count + 1 }
            }
            return col
          }),
        }
      })

      try {
        await moveStage.mutateAsync({ leadId, stageId: targetStageId, reason: 'Movido pelo Kanban' })
      } catch (err: unknown) {
        queryClient.setQueryData<CrmPipelineResponse>(crmKeys.pipeline(), snapshot)
        const code = (err as { code?: string | number })?.code
        const message = (err as { message?: string })?.message ?? ''
        if (code === 22023 && message.includes('course')) {
          toast.error('Informe o curso de interesse antes de qualificar o Lead.')
        } else if (code === 42501) {
          toast.error('Você não possui permissão para mover este Lead.')
        } else {
          toast.error('Não foi possível mover o lead.')
        }
      }
    },
    [findStageForLead, moveStage, queryClient],
  )

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="min-w-[280px] shrink-0 space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ))}
      </div>
    )
  }

  if (isError || !columns.length) {
    return (
      <EmptyState icon={AlertTriangle} title="Não foi possível carregar o pipeline" description="Verifique sua conexão e tente novamente." />
    )
  }

  const selectedStage = mobileStage || columns[0]?.stage_id || ''

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <PipelineColumn key={col.stage_id} column={col} canMoveStage={canMoveStage} movingLeadId={movingLeadId} />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <Card className="p-3 shadow-lg opacity-90 rotate-2">
              <p className="text-sm font-semibold">{activeLead.full_name}</p>
              <p className="text-xs text-muted">{activeLead.course_name ?? 'Sem curso'}</p>
              {activeLead.temperature && <Badge variant={CRM_TEMPERATURE_TONES[activeLead.temperature]}>{CRM_TEMPERATURE_LABELS[activeLead.temperature]}</Badge>}
              <p className="text-[10px] text-muted">Etapa: {activeStageName}</p>
            </Card>
          ) : null}
        </DragOverlay>

        <div className="lg:hidden">
          <Select value={selectedStage} onChange={(e) => setMobileStage(e.target.value)}>
            {columns.map((col) => (
              <option key={col.stage_id} value={col.stage_id}>
                {col.stage_name} ({col.total_count})
              </option>
            ))}
          </Select>
        </div>

        <div className="lg:hidden">
          {columns
            .filter((col) => col.stage_id === selectedStage)
            .map((col) => (
              <div key={col.stage_id} className="space-y-3">
                {col.leads.length === 0 ? (
                  <EmptyState icon={Clock} title="Nenhum lead" description="Nenhum lead nesta etapa." />
                ) : (
                  col.leads.map((lead) => (
                    <MobileLeadCard
                      key={lead.id}
                      lead={lead}
                      currentStageId={col.stage_id}
                      columns={columns}
                      canMoveStage={canMoveStage}
                      onStageChange={handleMobileStageChange}
                    />
                  ))
                )}
              </div>
            ))}
        </div>
      </DndContext>
    </div>
  )
}

function PipelineColumn({
  column,
  canMoveStage,
  movingLeadId,
}: {
  column: CrmPipelineColumn
  canMoveStage: boolean
  movingLeadId: string | null
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.stage_id })

  return (
    <div ref={setNodeRef} className={`min-w-[280px] max-w-[320px] shrink-0 space-y-3 rounded-lg border-2 transition-colors ${isOver ? 'border-navy bg-navy/5' : 'border-transparent'}`}>
      <div className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-navy">{column.stage_name}</h3>
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">{column.total_count}</span>
      </div>
      <div className="max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto pr-1">
        {column.leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nenhum lead</p>
        ) : (
          column.leads.map((lead) => (
            <DraggableLeadCard
              key={lead.id}
              lead={lead}
              stageName={column.stage_name}
              canMoveStage={canMoveStage}
              disabled={movingLeadId === lead.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

function DraggableLeadCard({
  lead,
  stageName,
  canMoveStage,
  disabled,
}: {
  lead: CrmLeadCard
  stageName: string
  canMoveStage: boolean
  disabled: boolean
}) {
  const navigate = useNavigate()
  const isDraggable = canMoveStage && lead.status === 'OPEN' && !disabled
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: !isDraggable,
  })

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  const handleClick = () => {
    if (isDragging) return
    navigate(`/crm/leads/${lead.id}`)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-card border bg-white shadow-ambient p-3 transition hover:-translate-y-0.5 hover:shadow-md ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isDragging ? 'opacity-40' : ''}`}
      onClick={handleClick}
      aria-label={`${lead.full_name} — ${stageName}. Pressione espaço para iniciar movimentação.`}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{lead.full_name}</p>
            <p className="truncate text-xs text-muted">{lead.course_name ?? 'Sem curso'}</p>
          </div>
          {lead.temperature && <Badge variant={CRM_TEMPERATURE_TONES[lead.temperature]}>{CRM_TEMPERATURE_LABELS[lead.temperature]}</Badge>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            {lead.owner_name && (
              <Tooltip content={lead.owner_name}>
                <Avatar name={lead.owner_name} className="size-6 text-[10px]" />
              </Tooltip>
            )}
            <span>{lead.days_in_stage}d na etapa</span>
          </div>
          {lead.overdue_activities > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <Clock className="size-3" /> {lead.overdue_activities}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function MobileLeadCard({
  lead,
  currentStageId,
  columns,
  canMoveStage,
  onStageChange,
}: {
  lead: CrmLeadCard
  currentStageId: string
  columns: CrmPipelineColumn[]
  canMoveStage: boolean
  onStageChange: (leadId: string, stageId: string) => void
}) {
  const navigate = useNavigate()

  return (
    <Card className="p-3 cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => navigate(`/crm/leads/${lead.id}`)}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{lead.full_name}</p>
            <p className="truncate text-xs text-muted">{lead.course_name ?? 'Sem curso'}</p>
          </div>
          {lead.temperature && <Badge variant={CRM_TEMPERATURE_TONES[lead.temperature]}>{CRM_TEMPERATURE_LABELS[lead.temperature]}</Badge>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            {lead.owner_name && (
              <Tooltip content={lead.owner_name}>
                <Avatar name={lead.owner_name} className="size-6 text-[10px]" />
              </Tooltip>
            )}
            <span>{lead.days_in_stage}d na etapa</span>
          </div>
          {lead.overdue_activities > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <Clock className="size-3" /> {lead.overdue_activities}
            </span>
          )}
        </div>
        {canMoveStage && lead.status === 'OPEN' && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-muted">Mover para:</span>
            <Select
              value={currentStageId}
              onChange={(e) => onStageChange(lead.id, e.target.value)}
              className="text-xs"
            >
              {columns.map((col) => (
                <option key={col.stage_id} value={col.stage_id}>
                  {col.stage_name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </Card>
  )
}
