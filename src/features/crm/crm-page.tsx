import { lazy, Suspense, useEffect } from 'react'
import { Plus, UserRoundSearch, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, PageHeader, Skeleton, Tabs } from '@/components/ui/core'
import { KPICard } from '@/components/ui/data'
import { useCrmKpis } from './crm-hooks'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'

const PipelineTab = lazy(() => import('./crm-pipeline').then((m) => ({ default: m.CrmPipeline })))
const LeadsTab = lazy(() => import('./leads-page').then((m) => ({ default: m.LeadsPage })))
const ActivitiesTab = lazy(() => import('./activities-page').then((m) => ({ default: m.ActivitiesPage })))
const CoursesTab = lazy(() => import('./course-catalog').then((m) => ({ default: m.CourseCatalog })))

const CRM_TABS = ['Pipeline', 'Leads', 'Atividades'] as const

const TAB_PARAM: Record<string, string> = {
  pipeline: 'Pipeline',
  leads: 'Leads',
  atividades: 'Atividades',
  cursos: 'Cursos'
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}
    </div>
  )
}

export function CrmPage() {
  const { permissions } = useAuth()
  const navigate = useNavigate()
  const canCreate = can(permissions, PERMISSIONS.CRM_CREATE)
  const canViewCourses = can(permissions, PERMISSIONS.COURSES_VIEW)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = TAB_PARAM[searchParams.get('tab')?.toLowerCase() ?? ''] ?? 'Pipeline'
  const effectiveTab = activeTab === 'Cursos' && !canViewCourses ? 'Pipeline' : activeTab
  const kpis = useCrmKpis()
  const tabs = canViewCourses ? [...CRM_TABS, 'Cursos'] : [...CRM_TABS]

  useEffect(() => {
    const tabKey = Object.keys(TAB_PARAM).find((k) => TAB_PARAM[k] === effectiveTab)
    const normalized = tabKey && tabKey !== 'pipeline' ? tabKey : null
    const current = searchParams.get('tab') || null
    if ((normalized ?? null) !== current) {
      const next = new URLSearchParams(searchParams)
      if (normalized) next.set('tab', normalized)
      else next.delete('tab')
      setSearchParams(next, { replace: true })
    }
  }, [effectiveTab, searchParams, setSearchParams])

  const handleTabChange = (label: string) => {
    const key = Object.keys(TAB_PARAM).find((k) => TAB_PARAM[k] === label)
    const next = new URLSearchParams(searchParams)
    if (key && key !== 'pipeline') {
      next.set('tab', key)
    } else {
      next.delete('tab')
    }
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="CRM Comercial" description="Organize leads, atendimentos e próximas ações do time comercial.">
        {canCreate && (
          <Button onClick={() => navigate('/crm/leads/novo')}>
            <Plus className="size-4" /> Novo Lead
          </Button>
        )}
      </PageHeader>

      <Tabs items={tabs} value={effectiveTab} onChange={handleTabChange} />

      {effectiveTab === 'Pipeline' && kpis.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard label="Leads abertos" value={String(kpis.data.open_leads)} icon={UserRoundSearch} />
          <KPICard label="Qualificados" value={String(kpis.data.qualified)} icon={TrendingUp} />
          <KPICard label="Em negociação" value={String(kpis.data.negotiation)} icon={Clock} />
          <KPICard label="Atividades atrasadas" value={String(kpis.data.overdue_activities)} icon={AlertTriangle} danger />
        </div>
      )}

      <Suspense fallback={<TabSkeleton />}>
        {effectiveTab === 'Pipeline' && <PipelineTab />}
        {effectiveTab === 'Leads' && <LeadsTab />}
        {effectiveTab === 'Atividades' && <ActivitiesTab />}
        {effectiveTab === 'Cursos' && canViewCourses && <CoursesTab />}
      </Suspense>
    </div>
  )
}
