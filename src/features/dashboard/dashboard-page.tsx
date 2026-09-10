import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MoreVertical, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  AlertCard,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Tabs
} from '@/components/ui/core'
import { KPICard, Timeline } from '@/components/ui/data'
import { useAuth } from '@/features/auth/auth-context'
import { can, PERMISSIONS } from '@/lib/rbac'
import { formatCurrency } from '@/lib/utils'
import { dashboardService } from './dashboard-service'

const periods = ['Este mês', 'Últimos 30 dias', 'Trimestre', 'Ano']
const valueLabel = (value: number, format: string) =>
  format === 'currency'
    ? formatCurrency(value)
    : format === 'percent'
      ? `${value.toLocaleString('pt-BR')}%`
      : value.toLocaleString('pt-BR')

export function DashboardPage() {
  const [period, setPeriod] = useState(periods[0]!)
  const { permissions } = useAuth()
  const canViewStudents = can(permissions, PERMISSIONS.STUDENTS_VIEW)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', period, canViewStudents],
    queryFn: () => dashboardService.getOverview({ canViewStudents })
  })
  if (isLoading) return <DashboardSkeleton />
  if (isError || !data)
    return (
      <Card>
        <EmptyState
          icon={TriangleAlert}
          title="Não foi possível carregar o dashboard"
          description="Verifique sua conexão e tente novamente."
        />
        <div className="pb-6 text-center">
          <Button onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      </Card>
    )
  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Visão Geral"
        description="Acompanhe os principais indicadores da Profissionaliza."
      >
        <Tabs items={periods} value={period} onChange={setPeriod} />
      </PageHeader>
      <section
        aria-label="Indicadores principais"
        className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]"
      >
        {data.kpis.map((kpi) => (
          <KPICard
            key={kpi.label}
            label={kpi.label}
            value={valueLabel(kpi.value, kpi.format)}
            icon={kpi.icon}
            trend={'trend' in kpi ? kpi.trend : undefined}
            danger={'danger' in kpi ? kpi.danger : false}
          />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Vendas x Recebimentos</h2>
              <p className="mt-1 text-sm text-muted">Evolução dos últimos sete meses</p>
            </div>
            <Button variant="ghost" aria-label="Mais opções" className="px-3">
              <MoreVertical className="size-5" />
            </Button>
          </div>
          <div className="h-[290px] w-full">
            <ResponsiveContainer>
              <AreaChart data={[...data.chart]} margin={{ left: -12, right: 4 }}>
                <defs>
                  <linearGradient id="navyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111744" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#111744" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: number) => `${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number | string) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 10, borderColor: '#E5E7EB' }}
                />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  name="Vendas"
                  stroke="#111744"
                  strokeWidth={2.5}
                  fill="url(#navyFill)"
                />
                <Area
                  type="monotone"
                  dataKey="recebimentos"
                  name="Recebimentos"
                  stroke="#D9B64A"
                  strokeWidth={2.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Funil Comercial</h2>
          <p className="mt-1 text-sm text-muted">Conversão do período selecionado</p>
          <div className="mt-6 space-y-3">
            {data.funnel.map((stage, index) => (
              <div
                key={stage.label}
                className="mx-auto flex min-h-14 items-center justify-between rounded-lg border border-navy/10 bg-navy-50 px-4"
                style={{
                  width: `${100 - index * 8}%`,
                  backgroundColor: index === data.funnel.length - 1 ? '#111744' : undefined,
                  color: index === data.funnel.length - 1 ? 'white' : undefined
                }}
              >
                <span className="text-sm font-medium">{stage.label}</span>
                <strong className="font-display text-xl">{stage.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <CalendarDays className="size-5 text-gold-dark" />
            <h2 className="text-lg font-semibold">Agenda</h2>
          </div>
          <div className="space-y-4">
            {data.agenda.map((item) => (
              <div key={`${item.time}-${item.title}`} className="flex gap-4">
                <time className="w-11 text-sm font-semibold text-navy">{item.time}</time>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Alertas gerenciais</h2>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <AlertCard
                key={alert.title}
                title={alert.title}
                variant={alert.tone as 'warning' | 'danger'}
              >
                {alert.detail}
              </AlertCard>
            ))}
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="mb-5 text-lg font-semibold">Atividades recentes</h2>
          <Timeline items={[...data.activities]} />
        </Card>
      </section>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-label="Carregando dashboard">
      <div>
        <Skeleton className="h-10 w-52" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-40" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-96 xl:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    </div>
  )
}
