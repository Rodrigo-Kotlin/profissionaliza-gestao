import { BookOpen, Pencil, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton, Textarea } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { Modal } from '@/components/ui/overlays'
import { useAuth } from '@/features/auth/auth-context'
import { getCourseErrorField, getCourseErrorMessage } from '@/lib/query'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useCrmCourses, useCreateCourse, useUpdateCourse } from './crm-hooks'
import { courseFormSchema, type CourseFormInput } from './crm-schemas'
import type { Course, CourseStatus } from './crm-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  ARCHIVED: 'Arquivado'
}

const COURSE_STATUS_TONES: Record<CourseStatus, 'warning' | 'success' | 'neutral' | 'info'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ARCHIVED: 'info'
}

const MODALITY_LABELS: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  ONLINE: 'Online',
  HIBRIDO: 'Híbrido'
}

export function CourseCatalog() {
  const { permissions } = useAuth()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const canManage = can(permissions, PERMISSIONS.COURSES_MANAGE)
  const courses = useCrmCourses(statusFilter ?? undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setModalOpen(true)
  }

  const handleCreate = () => {
    setEditingCourse(null)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Catálogo de Cursos" description="Gerencie os cursos disponíveis para os leads.">
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus className="size-4" /> Novo Curso
          </Button>
        )}
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={statusFilter ?? ''} onChange={(e) => setStatusFilter(e.target.value || null)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ARCHIVED">Arquivados</option>
          </Select>
          <span className="text-sm text-muted">
            {courses.data?.length ?? 0} curso{(courses.data?.length ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {courses.isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : courses.isError ? (
          <EmptyState icon={BookOpen} title="Erro ao carregar cursos" description="Verifique sua conexão e tente novamente." />
        ) : !courses.data?.length ? (
          <EmptyState icon={BookOpen} title="Nenhum curso encontrado" description="Crie o primeiro curso do catálogo." />
        ) : (
          <DataTable
            data={courses.data}
            getKey={(row) => row.id}
            mobileCard={(row) => <CourseMobileRow row={row} onEdit={() => handleEdit(row)} canManage={canManage} />}
            columns={[
              { key: 'code', header: 'Código', cell: (row) => <span className="font-mono text-xs text-muted">{row.code}</span> },
              {
                key: 'name',
                header: 'Nome',
                cell: (row) => <span className="text-sm font-semibold text-navy">{row.name}</span>
              },
              { key: 'category', header: 'Categoria', priority: 'medium', cell: (row) => <span className="text-muted">{row.category ?? '—'}</span> },
              { key: 'modality', header: 'Modalidade', priority: 'medium', cell: (row) => <Badge>{MODALITY_LABELS[row.modality]}</Badge> },
              { key: 'workload', header: 'Carga horária', priority: 'low', cell: (row) => row.workload_hours ? `${row.workload_hours}h` : '—' },
              { key: 'price', header: 'Valor', priority: 'low', cell: (row) => row.default_price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.default_price) : '—' },
              {
                key: 'status',
                header: 'Status',
                cell: (row) => <Badge variant={COURSE_STATUS_TONES[row.status]}>{COURSE_STATUS_LABELS[row.status]}</Badge>
              },
              {
                key: 'actions',
                header: '',
                priority: 'high',
                cell: (row) =>
                  canManage ? (
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                  ) : null
              }
            ]}
          />
        )}
      </Card>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editingCourse ? 'Editar curso' : 'Novo curso'}>
        <CourseForm
          course={editingCourse}
          onDone={() => { setModalOpen(false); setEditingCourse(null) }}
        />
      </Modal>
    </div>
  )
}

function CourseMobileRow({ row, onEdit, canManage }: { row: Course; onEdit: () => void; canManage: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{row.name}</p>
          <p className="font-mono text-xs text-muted">{row.code}</p>
        </div>
        <Badge variant={COURSE_STATUS_TONES[row.status]}>{COURSE_STATUS_LABELS[row.status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span>{MODALITY_LABELS[row.modality]}</span>
        {row.workload_hours && <span>· {row.workload_hours}h</span>}
        {row.default_price && <span>· {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.default_price)}</span>}
      </div>
      {canManage && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" /> Editar
        </Button>
      )}
    </div>
  )
}

function CourseForm({ course, onDone }: { course: Course | null; onDone: () => void }) {
  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CourseFormInput>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: course ? {
      code: course.code,
      name: course.name,
      short_name: course.short_name ?? '',
      category: course.category ?? '',
      modality: course.modality,
      status: course.status,
      workload_hours: course.workload_hours ?? undefined,
      duration_value: course.duration_value ?? undefined,
      duration_unit: course.duration_unit ?? '',
      default_price: course.default_price ?? undefined,
      description: course.description ?? ''
    } : {
      modality: 'PRESENCIAL'
    }
  })

  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [fieldServerErrors, setFieldServerErrors] = useState<Record<string, string>>({})

  const onSubmit = async (values: CourseFormInput) => {
    setSubmitMessage(null)
    setFieldServerErrors({})
    try {
      if (course) {
        await updateCourse.mutateAsync({
          courseId: course.id,
          input: {
            name: values.name,
            short_name: values.short_name || undefined,
            category: values.category || undefined,
            modality: values.modality,
            status: values.status,
            workload_hours: values.workload_hours ?? undefined,
            duration_value: values.duration_value ?? undefined,
            duration_unit: values.duration_unit || undefined,
            default_price: values.default_price ?? undefined,
            description: values.description || undefined
          }
        })
        toast.success('Curso atualizado.')
      } else {
        await createCourse.mutateAsync({
          code: values.code,
          name: values.name,
          short_name: values.short_name || undefined,
          category: values.category || undefined,
          modality: values.modality,
          workload_hours: values.workload_hours ?? undefined,
          duration_value: values.duration_value ?? undefined,
          duration_unit: values.duration_unit || undefined,
          default_price: values.default_price ?? undefined,
          description: values.description || undefined
        })
        toast.success('Curso criado.')
      }
      onDone()
    } catch (err: unknown) {
      const msg = getCourseErrorMessage(err)
      const field = getCourseErrorField(err)
      setSubmitMessage(msg)
      if (field) setFieldServerErrors({ [field]: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Código *"
          error={errors.code?.message ?? fieldServerErrors.code}
          disabled={Boolean(course)}
          {...register('code')}
          placeholder="Ex: TEC01"
        />
        <Input label="Nome *" error={errors.name?.message} {...register('name')} placeholder="Nome do curso" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome abreviado" error={errors.short_name?.message} {...register('short_name')} />
        <Input label="Categoria" error={errors.category?.message} {...register('category')} placeholder="Ex: Tecnologia" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Modalidade *</label>
          <Select {...register('modality')}>
            <option value="PRESENCIAL">Presencial</option>
            <option value="ONLINE">Online</option>
            <option value="HIBRIDO">Híbrido</option>
          </Select>
          {errors.modality && <p className="mt-1 text-xs text-red-600">{errors.modality.message}</p>}
        </div>
        {course ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
            <Select {...register('status')}>
              <option value="DRAFT">Rascunho</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="ARCHIVED">Arquivado</option>
            </Select>
            {errors.status && <p className="mt-1 text-xs text-red-600">{errors.status.message}</p>}
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
            <p className="text-sm text-muted mt-2">Rascunho (padrão)</p>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Carga horária (h)" type="number" error={errors.workload_hours?.message} {...register('workload_hours', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
        <Input label="Valor (R$)" type="number" step="0.01" error={errors.default_price?.message} {...register('default_price', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
        <Input label="Duração (valor)" type="number" error={errors.duration_value?.message} {...register('duration_value', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Duração (unidade)" placeholder="Ex: meses" error={errors.duration_unit?.message} {...register('duration_unit')} />
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">Descrição</label>
      <Textarea rows={3} {...register('description')} />
      {submitMessage && <p className="text-sm text-red-600">{submitMessage}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          <Save className="size-4" /> {course ? 'Salvar' : 'Criar curso'}
        </Button>
      </div>
    </form>
  )
}
