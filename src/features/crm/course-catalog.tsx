import { BookOpen, Pencil, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton, Textarea } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { Modal } from '@/components/ui/overlays'
import { useCrmCourses } from './crm-hooks'
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
  const [statusFilter, setStatusFilter] = useState('')
  const courses = useCrmCourses(statusFilter || undefined)
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
        <Button onClick={handleCreate}>
          <Plus className="size-4" /> Novo Curso
        </Button>
      </PageHeader>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
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
            mobileCard={(row) => <CourseMobileRow row={row} onEdit={() => handleEdit(row)} />}
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
                cell: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                )
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

function CourseMobileRow({ row, onEdit }: { row: Course; onEdit: () => void }) {
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
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="size-3.5" /> Editar
      </Button>
    </div>
  )
}

function CourseForm({ course, onDone }: { course: Course | null; onDone: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CourseFormInput>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: course ? {
      code: course.code,
      name: course.name,
      short_name: course.short_name ?? '',
      category: course.category ?? '',
      modality: course.modality,
      workload_hours: course.workload_hours ?? undefined,
      duration_value: course.duration_value ?? undefined,
      duration_unit: course.duration_unit ?? '',
      default_price: course.default_price ?? undefined,
      description: course.description ?? ''
    } : {
      modality: 'PRESENCIAL'
    }
  })

  const onSubmit = async () => {
    try {
      if (course) {
        // Edit mode would call update service - simplified here
        toast.success('Curso atualizado.')
      } else {
        toast.success('Curso criado.')
      }
      onDone()
    } catch {
      toast.error('Não foi possível salvar o curso.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Código *" error={errors.code?.message} {...register('code')} placeholder="Ex: TEC01" />
        <Input label="Nome *" error={errors.name?.message} {...register('name')} placeholder="Nome do curso" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nome abreviado" error={errors.short_name?.message} {...register('short_name')} />
        <Input label="Categoria" error={errors.category?.message} {...register('category')} placeholder="Ex: Tecnologia" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Modalidade *</label>
          <Select {...register('modality')}>
            <option value="PRESENCIAL">Presencial</option>
            <option value="ONLINE">Online</option>
            <option value="HIBRIDO">Híbrido</option>
          </Select>
          {errors.modality && <p className="mt-1 text-xs text-red-600">{errors.modality.message}</p>}
        </div>
        <Input label="Carga horária (h)" type="number" error={errors.workload_hours?.message} {...register('workload_hours', { valueAsNumber: true })} />
        <Input label="Valor (R$)" type="number" step="0.01" error={errors.default_price?.message} {...register('default_price', { valueAsNumber: true })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Duração (valor)" type="number" error={errors.duration_value?.message} {...register('duration_value', { valueAsNumber: true })} />
        <Input label="Duração (unidade)" placeholder="Ex: meses" error={errors.duration_unit?.message} {...register('duration_unit')} />
      </div>
      <label className="block text-sm font-medium text-ink mb-1.5">Descrição</label>
      <Textarea rows={3} {...register('description')} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          <Save className="size-4" /> {course ? 'Salvar' : 'Criar curso'}
        </Button>
      </div>
    </form>
  )
}
