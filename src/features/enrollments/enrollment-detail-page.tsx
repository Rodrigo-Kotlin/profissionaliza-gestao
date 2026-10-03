import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Eye, FileSignature, GraduationCap, ShoppingBag } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Breadcrumb, EmptyState, PageHeader, Skeleton } from '@/components/ui/core'
import { useEnrollmentDetail, useEnrollmentList } from './enrollments-hooks'
import { EnrollmentActions } from './enrollment-actions'
import { EnrollmentStatusBadge } from './enrollment-status-badge'
import { formatEnrollmentDateTime } from './enrollment-utils'

export function EnrollmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const detail = useEnrollmentDetail(id)

  if (detail.isLoading) return <EnrollmentDetailSkeleton />
  if (detail.isError || !detail.data) return <Card><EmptyState icon={Eye} title="Matrícula não encontrada" description="Verifique o link ou tente novamente." /></Card>

  const { enrollment, student, course, sale, contract } = detail.data
  return (
    <div className="space-y-6 md:space-y-8">
      <Breadcrumb items={[{ label: 'Matrículas', href: '/matriculas' }, { label: enrollment.enrollment_code }]} />
      <PageHeader title="Matrícula">
        <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Voltar</Button>
        <EnrollmentActions enrollment={enrollment} />
      </PageHeader>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Código da matrícula</p><h1 className="mt-1 font-display text-2xl font-bold">{enrollment.enrollment_code}</h1><div className="mt-3 flex flex-wrap items-center gap-3"><EnrollmentStatusBadge status={enrollment.status} /><span className="flex items-center gap-1 text-sm text-muted"><CalendarDays className="size-4" />{new Date(enrollment.enrollment_date).toLocaleDateString('pt-BR')}</span></div></div>
          <div className="rounded-xl bg-navy-50 p-4 text-sm"><p className="text-muted">Estado acadêmico</p><p className="mt-1 font-semibold text-navy">{statusDescription(enrollment.status)}</p></div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5"><SectionHeader icon={GraduationCap} title="Aluno" /><dl className="space-y-2 text-sm"><Row label="Nome" value={student.name} /><Row label="Código" value={student.student_code} /><Row label="Status global" value={student.status} /></dl><Button variant="ghost" className="mt-3" onClick={() => navigate(`/alunos/${student.id}`)}>Ver aluno</Button></Card>
        <Card className="p-5"><SectionHeader icon={BookOpen} title="Curso" /><dl className="space-y-2 text-sm"><Row label="Nome" value={course.name} /><Row label="Código" value={course.code} /><Row label="Status" value={course.status} /></dl></Card>
        <Card className="p-5"><SectionHeader icon={ShoppingBag} title="Origem comercial" /><dl className="space-y-2 text-sm"><Row label="Venda" value={sale.sale_code} /><Row label="Status da venda" value={sale.status} /><Row label="Contrato" value={contract.contract_code} /><Row label="Status do contrato" value={contract.status} /></dl><div className="mt-3 flex flex-wrap gap-2"><Button variant="ghost" onClick={() => navigate(`/vendas/${sale.id}`)}>Ver venda</Button><Button variant="ghost" onClick={() => navigate(`/contratos/${contract.id}`)}>Ver contrato</Button></div></Card>
        <Card className="p-5"><SectionHeader icon={CalendarDays} title="Datas acadêmicas" /><dl className="space-y-2 text-sm"><Row label="Início" value={formatEnrollmentDateTime(enrollment.started_at)} /><Row label="Última pausa" value={formatEnrollmentDateTime(enrollment.paused_at)} /><Row label="Conclusão" value={formatEnrollmentDateTime(enrollment.completed_at)} /><Row label="Cancelamento" value={formatEnrollmentDateTime(enrollment.canceled_at)} /></dl></Card>
      </div>

      {(enrollment.notes || enrollment.pause_reason || enrollment.cancellation_reason) && <Card className="p-5"><SectionHeader icon={FileSignature} title="Observações" />{enrollment.notes && <Note label="Observações" value={enrollment.notes} />}{enrollment.pause_reason && <Note label="Motivo da pausa atual" value={enrollment.pause_reason} />}{enrollment.cancellation_reason && <Note label="Motivo do cancelamento" value={enrollment.cancellation_reason} />}</Card>}
      <Card className="p-5"><SectionHeader icon={CheckCircle2} title="Histórico de status" /><p className="text-sm text-muted">As transições são auditadas no backend. A timeline detalhada de pausas ainda não existe no MVP.</p></Card>
    </div>
  )
}

export function StudentEnrollmentsPanel({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const query = useEnrollmentList({ student_id: studentId, page: 1, page_size: 50 })
  const rows = query.data?.data ?? []
  if (query.isLoading) return <div className="space-y-3">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-20" />)}</div>
  if (query.isError) return <EmptyState icon={GraduationCap} title="Não foi possível carregar matrículas" description="Tente novamente mais tarde." />
  if (!rows.length) return <EmptyState icon={GraduationCap} title="Nenhuma matrícula registrada" description="As matrículas aparecerão após contratos assinados." />
  return <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => <button key={row.enrollment_id} type="button" onClick={() => navigate(`/matriculas/${row.enrollment_id}`)} className="rounded-xl border p-4 text-left transition hover:border-navy/40 hover:bg-navy-50"><div className="flex items-start justify-between gap-3"><span className="font-mono text-xs font-semibold text-navy">{row.enrollment_code}</span><EnrollmentStatusBadge status={row.status} /></div><p className="mt-2 font-semibold">{row.course_name}</p><p className="mt-1 text-xs text-muted">{new Date(row.enrollment_date).toLocaleDateString('pt-BR')} · Ver matrícula</p></button>)}</div>
}

function statusDescription(status: string): string {
  return { PENDING: 'Aguardando início', ACTIVE: 'Formação em andamento', PAUSED: 'Formação pausada', COMPLETED: 'Formação concluída', CANCELED: 'Matrícula cancelada' }[status] ?? status
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) { return <div className="mb-3 flex items-center gap-2"><Icon className="size-4 text-muted" /><h2 className="text-sm font-semibold">{title}</h2></div> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-muted">{label}</dt><dd className="text-right font-medium">{value}</dd></div> }
function Note({ label, value }: { label: string; value: string }) { return <div className="mb-3 last:mb-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{value}</p></div> }
function EnrollmentDetailSkeleton() { return <div className="space-y-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-32" /><div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div></div> }
