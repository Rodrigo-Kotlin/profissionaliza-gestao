import { lazy, Suspense, useState } from 'react'
import { Plus, UserRoundSearch, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, PageHeader, Skeleton, Tabs } from '@/components/ui/core'
import { KPICard } from '@/components/ui/data'
import { useCrmKpis } from './crm-hooks'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'

const PipelineTab = lazy(() => import('./crm-pipeline').then((m) => ({ default: m.CrmPipeline })))
const LeadsTab = lazy(() => import('./leads-page').then((m) => ({ default: m.LeadsPage })))
const ActivitiesTab = lazy(() => import('./activities-page').then((m) => ({ default: m.ActivitiesPage })))
const CoursesTab = lazy(() => import('./course-catalog').then((m) => ({ default: m.CourseCatalog })))

const CRM_TABS = ['Pipeline', 'Leads', 'Atividades', 'Cursos'] as const

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
  const [activeTab, setActiveTab] = useState<string>('Pipeline')
  const kpis = useCrmKpis()

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="CRM Comercial" description="Organize leads, atendimentos e próximas ações do time comercial.">
        {canCreate && (
          <Button onClick={() => navigate('/crm/leads/novo')}>
            <Plus className="size-4" /> Novo Lead
          </Button>
        )}
      </PageHeader>

      <Tabs items={[...CRM_TABS]} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'Pipeline' && kpis.data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard label="Leads abertos" value={String(kpis.data.open_leads)} icon={UserRoundSearch} />
          <KPICard label="Qualificados" value={String(kpis.data.qualified)} icon={TrendingUp} />
          <KPICard label="Em negociação" value={String(kpis.data.negotiation)} icon={Clock} />
          <KPICard label="Atividades atrasadas" value={String(kpis.data.overdue_activities)} icon={AlertTriangle} danger />
        </div>
      )}

      <Suspense fallback={<TabSkeleton />}>
        {activeTab === 'Pipeline' && <PipelineTab />}
        {activeTab === 'Leads' && <LeadsTab />}
        {activeTab === 'Atividades' && <ActivitiesTab />}
        {activeTab === 'Cursos' && <CoursesTab />}
      </Suspense>
    </div>
  )
}
