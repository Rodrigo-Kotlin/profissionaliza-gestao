import { GraduationCap, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { Drawer } from '@/components/ui/overlays'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useCrmLeads } from './crm-hooks'
import { parseCrmLeadListParams, updateSearchParams } from './crm-utils'
import { CRM_STATUS_LABELS, CRM_TEMPERATURE_LABELS, CRM_TEMPERATURE_TONES, CRM_PIPELINE_STAGE_LABELS } from './crm-constants'
import type { CrmLeadListItem } from './crm-types'
import { LeadForm } from './lead-form'

const PAGE_SIZES = [20, 50, 100]

export function LeadsPage() {
  const { permissions } = useAuth()
  const canCreate = can(permissions, PERMISSIONS.CRM_CREATE)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileFilters, setMobileFilters] = useState(false)

  const parsed = useMemo(() => parseCrmLeadListParams(params), [params])
  const { data, isLoading, isError } = useCrmLeads(parsed)

  const setParam = (next: Record<string, string | undefined | null>) => {
    setParams(updateSearchParams(params, next), { replace: true })
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Leads" description="Lista completa de leads do funil comercial.">
        {canCreate && (
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="size-4" /> Novo Lead
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
            <Input
              aria-label="Buscar lead"
              placeholder="Nome, código ou telefone..."
              defaultValue={parsed.q ?? ''}
              onChange={(e) => setParam({ q: e.target.value || null })}
              className="pl-10"
            />
          </div>
          <div className="hidden gap-2 lg:flex">
            <Select aria-label="Filtrar por etapa" value={parsed.stage_code ?? ''} onChange={(e) => setParam({ stage: e.target.value || null })}>
              <option value="">Todas as etapas</option>
              {Object.entries(CRM_PIPELINE_STAGE_LABELS).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </Select>
            <Select aria-label="Filtrar por temperatura" value={parsed.temperature ?? ''} onChange={(e) => setParam({ temp: e.target.value || null })}>
              <option value="">Todas</option>
              {Object.entries(CRM_TEMPERATURE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select aria-label="Filtrar por status" value={parsed.status ?? ''} onChange={(e) => setParam({ status: e.target.value || null })}>
              <option value="">Todos</option>
              {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setParam({ q: null, stage: null, temp: null, status: null, page: null })}>
              Limpar
            </Button>
          </div>
          <Button variant="secondary" className="lg:hidden" onClick={() => setMobileFilters((v) => !v)}>
            <SlidersHorizontal className="size-4" /> Filtros
          </Button>
        </div>
        {mobileFilters && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:hidden">
            <Select aria-label="Filtrar por etapa" value={parsed.stage_code ?? ''} onChange={(e) => setParam({ stage: e.target.value || null })}>
              <option value="">Todas as etapas</option>
              {Object.entries(CRM_PIPELINE_STAGE_LABELS).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </Select>
            <Select aria-label="Filtrar por temperatura" value={parsed.temperature ?? ''} onChange={(e) => setParam({ temp: e.target.value || null })}>
              <option value="">Todas</option>
              {Object.entries(CRM_TEMPERATURE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select aria-label="Filtrar por status" value={parsed.status ?? ''} onChange={(e) => setParam({ status: e.target.value || null })}>
              <option value="">Todos</option>
              {Object.entries(CRM_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : isError ? (
          <EmptyState icon={GraduationCap} title="Não foi possível carregar os leads" description="Verifique sua conexão e tente novamente." />
        ) : !data?.data.length ? (
          <EmptyState icon={GraduationCap} title="Nenhum lead encontrado" description="Ajuste os filtros ou crie um novo lead." />
        ) : (
          <DataTable
            data={data.data}
            getKey={(row) => row.id}
            mobileCard={(row) => <LeadMobileRow row={row} />}
            columns={[
              { key: 'code', header: 'Código', priority: 'medium', cell: (row) => <span className="font-mono text-xs text-muted">{row.lead_code}</span> },
              {
                key: 'name',
                header: 'Lead',
                cell: (row) => (
                  <button className="text-sm font-semibold text-navy hover:underline" onClick={() => navigate(`/crm/leads/${row.id}`)}>
                    {row.full_name}
                  </button>
                )
              },
              { key: 'course', header: 'Curso', priority: 'medium', cell: (row) => <span className="text-muted">{row.course_name ?? '—'}</span> },
              { key: 'stage', header: 'Etapa', priority: 'medium', cell: (row) => <Badge>{row.stage_name}</Badge> },
              {
                key: 'temperature',
                header: 'Temperatura',
                cell: (row) => row.temperature ? <Badge variant={CRM_TEMPERATURE_TONES[row.temperature]}>{CRM_TEMPERATURE_LABELS[row.temperature]}</Badge> : <span className="text-muted">—</span>
              },
              { key: 'owner', header: 'Responsável', priority: 'medium', cell: (row) => <span className="text-muted">{row.owner_name ?? '—'}</span> },
              {
                key: 'next_action',
                header: 'Próxima ação',
                priority: 'low',
                cell: (row) => (
                  <div className="max-w-[200px] truncate text-muted">
                    {row.next_activity_summary ?? '—'}
                    {row.overdue_count > 0 && <Badge variant="danger" className="ml-1">{row.overdue_count}</Badge>}
                  </div>
                )
              },
              {
                key: 'created',
                header: 'Criado em',
                priority: 'low',
                cell: (row) => new Date(row.created_at).toLocaleDateString('pt-BR')
              },
              {
                key: 'actions',
                header: '',
                priority: 'high',
                cell: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/crm/leads/${row.id}`)}>
                    Ver lead
                  </Button>
                )
              }
            ]}
          />
        )}
      </Card>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Paginação">
        <span className="text-sm text-muted">
          {data?.total ?? 0} lead{(data?.total ?? 0) === 1 ? '' : 's'} encontrado{(data?.total ?? 0) === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-3">
          <Select
            aria-label="Itens por página"
            value={String(parsed.page_size)}
            onChange={(e) => setParam({ page_size: e.target.value, page: null })}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size} por página</option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={(parsed.page ?? 1) <= 1} onClick={() => setParam({ page: String((parsed.page ?? 1) - 1) })}>
              Anterior
            </Button>
            <span className="min-w-10 text-center text-sm font-semibold">{parsed.page ?? 1}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(data?.total ?? 0) <= (parsed.page ?? 1) * (parsed.page_size ?? 25)}
              onClick={() => setParam({ page: String((parsed.page ?? 1) + 1) })}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Novo Lead">
        <div className="h-full overflow-y-auto bg-white p-5">
          <LeadForm
            onCreated={(id) => {
              setDrawerOpen(false)
              navigate(`/crm/leads/${id}`)
            }}
            onCancel={() => setDrawerOpen(false)}
          />
        </div>
      </Drawer>
    </div>
  )
}

function LeadMobileRow({ row }: { row: CrmLeadListItem }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-1.5" role="listitem">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button className="block truncate text-left font-semibold text-navy" onClick={() => navigate(`/crm/leads/${row.id}`)}>
            {row.full_name}
          </button>
          <p className="font-mono text-xs text-muted">{row.lead_code}</p>
        </div>
        <div className="flex items-center gap-1">
          {row.temperature && <Badge variant={CRM_TEMPERATURE_TONES[row.temperature]}>{CRM_TEMPERATURE_LABELS[row.temperature]}</Badge>}
          <Badge>{row.stage_name}</Badge>
        </div>
      </div>
      {row.course_name && <p className="text-xs text-muted">{row.course_name}</p>}
      <button className="text-sm font-semibold text-navy hover:underline" onClick={() => navigate(`/crm/leads/${row.id}`)}>
        Ver lead
      </button>
    </div>
  )
}
