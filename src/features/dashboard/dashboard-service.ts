import { Banknote, CircleAlert, GraduationCap, Landmark, ReceiptText, UserPlus } from 'lucide-react'

export type DashboardData = Awaited<ReturnType<typeof dashboardService.getOverview>>
const demoData = {
  kpis: [
    { label: 'Vendas no mês', value: 86400, format: 'currency', trend: '+18,4%', icon: Banknote },
    { label: 'Novas matrículas', value: 42, format: 'number', trend: '+8,2%', icon: UserPlus },
    { label: 'Recebido no mês', value: 54250, format: 'currency', icon: Landmark },
    { label: 'Contas a receber', value: 112800, format: 'currency', icon: ReceiptText },
    { label: 'Inadimplência', value: 8.2, format: 'percent', trend: 'Dentro da meta', danger: true, icon: CircleAlert },
    { label: 'Alunos ativos', value: 384, format: 'number', icon: GraduationCap }
  ],
  chart: [
    { month: 'Abr', vendas: 56000, recebimentos: 42000 }, { month: 'Mai', vendas: 64000, recebimentos: 48000 },
    { month: 'Jun', vendas: 61000, recebimentos: 52000 }, { month: 'Jul', vendas: 73000, recebimentos: 50000 },
    { month: 'Ago', vendas: 78000, recebimentos: 57000 }, { month: 'Set', vendas: 81600, recebimentos: 53000 },
    { month: 'Out', vendas: 86400, recebimentos: 54250 }
  ],
  funnel: [{ label: 'Leads', value: 342 }, { label: 'Atendimentos', value: 156 }, { label: 'Negociações', value: 89 }, { label: 'Vendas', value: 42 }],
  agenda: [
    { time: '09:00', title: 'Reunião comercial', detail: 'Revisão de metas da semana' },
    { time: '14:00', title: 'Turma ADM-24', detail: 'Início de novo módulo' },
    { time: '17:30', title: 'Fechamento diário', detail: 'Conferência financeira' }
  ],
  alerts: [
    { title: '12 parcelas vencem hoje', detail: 'R$ 4.250 previstos', tone: 'warning' },
    { title: '7 alunos requerem atenção', detail: 'Frequência abaixo de 75%', tone: 'danger' }
  ],
  activities: [
    { title: 'Nova matrícula registrada', detail: 'Mariana Costa · há 18 min' },
    { title: 'Pagamento confirmado', detail: 'Contrato CT-2026-084 · há 42 min' },
    { title: 'Venda aprovada', detail: 'Curso Técnico em Administração · há 1h' }
  ]
} as const

export const dashboardService = { async getOverview() { await new Promise((resolve) => setTimeout(resolve, 250)); return demoData } }
