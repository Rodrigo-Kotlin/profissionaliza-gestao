import { BookOpen, Briefcase, CalendarDays, CircleDollarSign, FileText, History, Link2, Pencil, Phone, ShieldCheck, Unlink, UserPlus, ArrowRightLeft } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, Tabs } from '@/components/ui/core'
import { Modal, Tooltip } from '@/components/ui/overlays'
import { Timeline } from '@/components/ui/data'
import { can, PERMISSIONS, STUDENT_STATUS_LABELS, type StudentStatus } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'
import { useChangeStudentStatus, useStudentDetail, useStudentGuardians, useStudentHistory, useUnlinkGuardian } from './students-hooks'
import { ChangeStatusForm } from './change-status'
import { GuardianForm } from './guardian-form'
import { maskPhone, STATUS_TONE } from './students-utils'
import type { Guardian } from './students-types'

const TABS = ['Visão Geral', 'Responsáveis', 'Histórico', 'Acadêmico', 'Financeiro', 'Contratos', 'Documentos'] as const

export function StudentDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const studentId = id ?? ''
  const [tab, setTab] = useState<string>('Visão Geral')
  const [statusOpen, setStatusOpen] = useState(false)
  const [guardianOpen, setGuardianOpen] = useState(false)

  const detail = useStudentDetail(studentId)
  const guardians = useStudentGuardians(studentId)
  const history = useStudentHistory(studentId)
  const changeStatus = useChangeStudentStatus()

  const canEdit = can(permissions, PERMISSIONS.STUDENTS_EDIT)
  const canManageStatus = can(permissions, PERMISSIONS.STUDENTS_MANAGE_STATUS)
  const canManageGuardians = can(permissions, PERMISSIONS.GUARDIANS_MANAGE)

  if (detail.isLoading) return <PageSkeleton />

  if (detail.isError || !detail.data) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="Aluno não encontrado" description="Verifique o vínculo ou tente novamente." />
      </Card>
    )
  }

  const student = detail.data

  const handleChangeStatus = async (values: { new_status: string; reason?: string }) => {
    await changeStatus.mutateAsync({ id: studentId, status: values.new_status, reason: values.reason })
    setStatusOpen(false)
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Aluno">
        <Button variant="secondary" onClick={() => navigate('/alunos')}>Voltar</Button>
        {canEdit && (
          <Button variant="secondary" onClick={() => navigate(`/alunos/${studentId}/editar`)}>
            <Pencil className="size-4" /> Editar
          </Button>
        )}
        {canManageStatus && (
          <Button onClick={() => setStatusOpen(true)}>
            <ArrowRightLeft className="size-4" /> Alterar status
          </Button>
        )}
      </PageHeader>

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-balance">{student.full_name}</h1>
            <p className="mt-1 font-mono text-xs text-muted">{student.student_code}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Badge variant={STATUS_TONE[student.status]}>{STUDENT_STATUS_LABELS[student.status]}</Badge>
              {student.phone && <span className="flex items-center gap-1 text-sm text-muted"><Phone className="size-4" />{student.phone}</span>}
              {student.whatsapp && <span className="flex items-center gap-1 text-sm text-muted"><Phone className="size-4" />{student.whatsapp}</span>}
              <span className="flex items-center gap-1 text-sm text-muted"><CalendarDays className="size-4" />Cadastro em {new Date(student.registration_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs items={[...TABS]} value={tab} onChange={setTab} />

      {tab === 'Visão Geral' && <OverviewCards student={student} />}
      {tab === 'Responsáveis' && (
        <GuardiansPanel
          studentId={studentId}
          guardians={guardians.data}
          loading={guardians.isLoading}
          canManage={canManageGuardians}
          onAdd={() => setGuardianOpen(true)}
          sensitive={student.sensitive}
        />
      )}
      {tab === 'Histórico' && <HistoryPanel events={history.data} loading={history.isLoading} />}
      {tab === 'Acadêmico' && <EmptyState icon={BookOpen} title="Nenhuma matrícula registrada." description="As matrículas serão gerenciadas em uma próxima etapa." />}
      {tab === 'Financeiro' && <EmptyState icon={CircleDollarSign} title="Disponível em uma próxima etapa." description="O financeiro do aluno será apresentado quando o módulo for implementado." />}
      {tab === 'Contratos' && <EmptyState icon={Briefcase} title="Disponível em uma próxima etapa." description="Os contratos serão gerenciados em uma próxima etapa." />}
      {tab === 'Documentos' && <EmptyState icon={FileText} title="Disponível em uma próxima etapa." description="O repositório de documentos será apresentado futuramente." />}

      <Modal open={statusOpen} onOpenChange={setStatusOpen} title="Alterar status do aluno">
        <ChangeStatusForm currentStatus={student.status} onDone={handleChangeStatus} onCancel={() => setStatusOpen(false)} />
      </Modal>

      <Modal open={guardianOpen} onOpenChange={setGuardianOpen} title="Vincular responsável">
        <GuardianForm studentId={studentId} onDone={() => setGuardianOpen(false)} />
      </Modal>
    </div>
  )
}

function defaultValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Não informado'
  return String(value)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function OverviewCards({ student }: { student: { full_name: string; preferred_name: string | null; cpf: string | null; rg: string | null; birth_date: string | null; phone: string | null; whatsapp: string | null; email: string | null; street: string | null; number: string | null; complement: string | null; district: string | null; city: string | null; state: string | null; postal_code: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; notes: string | null; origin: string | null; status: StudentStatus; registration_date: string } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Dados pessoais</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Nome" value={defaultValue(student.full_name)} />
          <Row label="Nome social" value={defaultValue(student.preferred_name)} />
          <Row label="CPF" value={defaultValue(student.cpf)} />
          <Row label="RG" value={defaultValue(student.rg)} />
          <Row label="Nascimento" value={student.birth_date ? new Date(student.birth_date).toLocaleDateString('pt-BR') : 'Não informado'} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Contato</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Telefone" value={defaultValue(student.phone)} />
          <Row label="WhatsApp" value={defaultValue(student.whatsapp)} />
          <Row label="E-mail" value={defaultValue(student.email)} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Endereço</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Endereço" value={defaultValue([student.street, student.number, student.complement].filter(Boolean).join(', '))} />
          <Row label="Bairro" value={defaultValue(student.district)} />
          <Row label="Cidade" value={defaultValue(student.city)} />
          <Row label="UF" value={defaultValue(student.state)} />
          <Row label="CEP" value={defaultValue(student.postal_code)} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Emergência</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Contato" value={defaultValue(student.emergency_contact_name)} />
          <Row label="Telefone" value={defaultValue(student.emergency_contact_phone)} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Informações internas</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Status" value={defaultValue(STUDENT_STATUS_LABELS[student.status])} />
          <Row label="Cadastro" value={new Date(student.registration_date + 'T00:00:00').toLocaleDateString('pt-BR')} />
          <Row label="Origem" value={defaultValue(student.origin)} />
          <Row label="Observações" value={defaultValue(student.notes)} />
        </dl>
      </Card>
    </div>
  )
}

function GuardiansPanel({
  studentId,
  guardians,
  loading,
  canManage,
  onAdd,
  sensitive
}: {
  studentId: string
  guardians?: Guardian[]
  loading: boolean
  canManage: boolean
  onAdd: () => void
  sensitive: boolean
}) {
  const unlink = useUnlinkGuardian(studentId)
  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button onClick={onAdd}><UserPlus className="size-4" /> Adicionar responsável</Button>
        </div>
      )}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !guardians?.length ? (
        <EmptyState icon={Link2} title="Nenhum responsável vinculado." description="Adicione um responsável para acompanhar o aluno." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {guardians.map((guardian) => (
            <Card key={guardian.guardian_id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{guardian.full_name}</p>
                  <p className="text-xs text-muted">{guardian.relationship}</p>
                </div>
                {canManage && (
                  <Tooltip content="Remover vínculo">
                    <Button variant="ghost" size="sm" className="px-2 text-red-600" onClick={() => unlink.mutate(guardian.guardian_id)}>
                      <Unlink className="size-4" />
                    </Button>
                  </Tooltip>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {guardian.is_primary_contact && <Badge variant="info">Principal</Badge>}
                {guardian.is_financial_responsible && <Badge variant="success">Financeiro</Badge>}
                {guardian.is_legal_guardian && <Badge variant="warning">Legal</Badge>}
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="Telefone" value={defaultValue(sensitive ? guardian.phone : maskPhone(guardian.phone))} />
                <Row label="E-mail" value={defaultValue(sensitive ? guardian.email : guardian.email ? maskFirstChar(guardian.email) : 'Não informado')} />
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryPanel({ events, loading }: { events?: { title: string; detail: string }[]; loading: boolean }) {
  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
  if (!events?.length) return <EmptyState icon={History} title="Nenhum evento registrado." description="As alterações neste aluno aparecerão aqui." />
  return <Card className="p-5 sm:p-6"><Timeline items={events} /></Card>
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando aluno">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-36" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
    </div>
  )
}

function maskFirstChar(email: string): string {
  if (!email.includes('@')) return '***'
  return `${email.slice(0, 1)}***@${email.slice(email.indexOf('@') + 1)}`
}