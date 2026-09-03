import { Clock, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Badge, Card, EmptyState, Select, Skeleton } from '@/components/ui/core'
import { Tooltip } from '@/components/ui/overlays'
import { useCrmPipeline } from './crm-hooks'
import { CRM_TEMPERATURE_LABELS, CRM_TEMPERATURE_TONES } from './crm-constants'
import type { CrmLeadCard, CrmPipelineColumn } from './crm-types'

export function CrmPipeline() {
  const { data, isLoading, isError } = useCrmPipeline()
  const [mobileStage, setMobileStage] = useState('')

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

  if (isError || !data?.columns.length) {
    return (
      <EmptyState icon={AlertTriangle} title="Não foi possível carregar o pipeline" description="Verifique sua conexão e tente novamente." />
    )
  }

  const columns = data.columns
  const selectedStage = mobileStage || columns[0]?.stage_id || ''

  return (
    <div className="space-y-4">
      <div className="lg:hidden">
        <Select value={selectedStage} onChange={(e) => setMobileStage(e.target.value)}>
          {columns.map((col) => (
            <option key={col.stage_id} value={col.stage_id}>
              {col.stage_name} ({col.total_count})
            </option>
          ))}
        </Select>
      </div>

      <div className="hidden lg:flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <PipelineColumn key={col.stage_id} column={col} />
        ))}
      </div>

      <div className="lg:hidden">
        {columns
          .filter((col) => col.stage_id === selectedStage)
          .map((col) => (
            <div key={col.stage_id} className="space-y-3">
              {col.leads.length === 0 ? (
                <EmptyState icon={Clock} title="Nenhum lead" description="Nenhum lead nesta etapa." />
              ) : (
                col.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
              )}
            </div>
          ))}
      </div>
    </div>
  )
}

function PipelineColumn({ column }: { column: CrmPipelineColumn }) {
  return (
    <div className="min-w-[280px] max-w-[320px] shrink-0 space-y-3">
      <div className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-navy">{column.stage_name}</h3>
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
          {column.total_count}
        </span>
      </div>
      <div className="max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto pr-1">
        {column.leads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nenhum lead</p>
        ) : (
          column.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  )
}

function LeadCard({ lead }: { lead: CrmLeadCard }) {
  const navigate = useNavigate()

  return (
    <Card
      className="cursor-pointer p-3 transition hover:-translate-y-0.5 hover:shadow-md"
      onClick={() => navigate(`/crm/leads/${lead.id}`)}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{lead.full_name}</p>
            <p className="truncate text-xs text-muted">{lead.course_name ?? 'Sem curso'}</p>
          </div>
          {lead.temperature && (
            <Badge variant={CRM_TEMPERATURE_TONES[lead.temperature]}>
              {CRM_TEMPERATURE_LABELS[lead.temperature]}
            </Badge>
          )}
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
    </Card>
  )
}
