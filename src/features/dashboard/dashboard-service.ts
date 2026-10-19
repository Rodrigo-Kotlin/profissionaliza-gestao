import { GraduationCap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export type DashboardData = Awaited<ReturnType<typeof dashboardService.getOverview>>
type DashboardKpi = { label: string; value: number; format: string; icon: LucideIcon; trend?: string; danger?: boolean }
type DashboardOverview = {
  kpis: DashboardKpi[]
  chart: { month: string; vendas: number; recebimentos: number }[]
  funnel: { label: string; value: number }[]
  agenda: { time: string; title: string; detail: string }[]
  alerts: { title: string; detail: string; tone: 'warning' | 'danger' }[]
  activities: { title: string; detail: string }[]
}
export const dashboardService = {
  async getOverview({ canViewStudents }: { canViewStudents: boolean }): Promise<DashboardOverview> {
    const kpis: DashboardKpi[] = []

    if (canViewStudents) {
      const { data, error } = await supabase.rpc('student_kpis')
      if (!error && data && typeof data === 'object') {
        const studentKpi = data as { active: number }
        kpis.push({ label: 'Alunos ativos', value: Number(studentKpi.active) || 0, format: 'number', icon: GraduationCap })
      }
    }

    return { kpis, chart: [], funnel: [], agenda: [], alerts: [], activities: [] }
  }
}
