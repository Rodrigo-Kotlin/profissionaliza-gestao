import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button, Input, Radio, Select, Textarea } from '@/components/ui/core'
import { useCreateLead, useCrmCourses, useCrmPipelineStages } from './crm-hooks'
import { leadFormSchema, type LeadFormInput } from './crm-schemas'
import { CRM_LEAD_SOURCES, CRM_SOURCE_LABELS, CRM_ACTIVITY_TYPES, CRM_ACTIVITY_TYPE_LABELS, CRM_TEMPERATURE_LABELS } from './crm-constants'
import { normalizePhone, normalizeEmail, parsePossibleDuplicateError, possibleDuplicateMessage } from './crm-utils'
import { formatCpfInput, normalizeCpf } from '../students/students-utils'
import { saveLeadDraft, loadLeadDraft, clearLeadDraft } from './lead-draft'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'

const DEFAULT_LEAD_DEFAULTS = {
  temperature: 'WARM' as const,
  source_code: '',
  stage_id: ''
}

export function LeadForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const createLead = useCreateLead()
  const courses = useCrmCourses('ACTIVE')
  const stagesQuery = useCrmPipelineStages()
  const { permissions } = useAuth()
  const canMoveStage = can(permissions, PERMISSIONS.CRM_MOVE_STAGE)
  const [defaults] = useState(() => ({ ...DEFAULT_LEAD_DEFAULTS, ...loadLeadDraft() }))
  const [identityConflict, setIdentityConflict] = useState<string[] | null>(null)
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: defaults
  })

  useEffect(() => {
    const subscription = watch((values) => saveLeadDraft(values as Partial<LeadFormInput>))
    return () => subscription.unsubscribe()
  }, [watch])

  const runSubmit = async (values: LeadFormInput, force: boolean) => {
    try {
      const id = await createLead.mutateAsync({
        full_name: values.full_name,
        cpf: values.cpf ? normalizeCpf(values.cpf) : undefined,
        phone: values.phone ? normalizePhone(values.phone) : undefined,
        whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
        email: values.email ? normalizeEmail(values.email) : undefined,
        source_code: values.source_code,
        course_interest_id: values.course_interest_id || undefined,
        stage_id: values.stage_id || undefined,
        temperature: values.temperature,
        commercial_notes: values.commercial_notes,
        first_activity_title: values.first_activity_title,
        first_activity_type: values.first_activity_type,
        first_activity_due_at: values.first_activity_due_at,
        force_create: force
      })
      toast.success('Lead criado com sucesso.')
      clearLeadDraft()
      onCreated(id)
    } catch (err) {
      const conflict = parsePossibleDuplicateError(err)
      if (conflict) {
        setIdentityConflict(conflict.fields)
        return
      }
      setIdentityConflict(null)
      toast.error(err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Não foi possível criar o lead.')
    }
  }

  const onSubmit = (values: LeadFormInput) => runSubmit(values, false)
  const onSubmitForced = (values: LeadFormInput) => runSubmit(values, true)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        <Input label="Nome completo *" error={errors.full_name?.message} {...register('full_name')} placeholder="Nome do lead" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="CPF"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            error={errors.cpf?.message}
            {...register('cpf')}
            onChange={(event) => {
              const masked = formatCpfInput(event.target.value)
              setValue('cpf', masked, { shouldValidate: false, shouldDirty: true })
            }}
          />
          <Input label="Telefone" inputMode="tel" placeholder="(00) 00000-0000" error={errors.phone?.message} {...register('phone')} />
          <Input label="WhatsApp" inputMode="tel" placeholder="(00) 00000-0000" error={errors.whatsapp?.message} {...register('whatsapp')} />
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Origem *</label>
          <Select {...register('source_code')}>
            <option value="">Selecione a origem</option>
            {CRM_LEAD_SOURCES.filter((s) => s.is_active).map((source) => (
              <option key={source.code} value={source.code}>{CRM_SOURCE_LABELS[source.code]}</option>
            ))}
          </Select>
          {errors.source_code && <p className="mt-1 text-xs text-red-600">{errors.source_code.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Curso de interesse</label>
          <Select {...register('course_interest_id')}>
            <option value="">Selecione o curso</option>
            {courses.data?.map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </Select>
        </div>

        {canMoveStage && stagesQuery.data && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Etapa inicial</label>
            <Select {...register('stage_id')}>
              <option value="">Novo Lead</option>
              {stagesQuery.data.filter(s => s.code !== 'WON' && s.code !== 'LOST').map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Temperatura</label>
          <div className="flex gap-4">
            {(['HOT', 'WARM', 'COLD'] as const).map((temp) => (
              <label key={temp} className="flex items-center gap-2 text-sm">
                <Radio value={temp} {...register('temperature')} />
                {CRM_TEMPERATURE_LABELS[temp]}
              </label>
            ))}
          </div>
          {errors.temperature && <p className="mt-1 text-xs text-red-600">{errors.temperature.message}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-navy">Primeira atividade (opcional)</h3>
        <Input label="Título da atividade" placeholder="Ex: Ligação de boas-vindas" error={errors.first_activity_title?.message} {...register('first_activity_title')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Tipo</label>
            <Select {...register('first_activity_type')}>
              <option value="">Selecione</option>
              {CRM_ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>{CRM_ACTIVITY_TYPE_LABELS[type]}</option>
              ))}
            </Select>
            {errors.first_activity_type && <p className="mt-1 text-xs text-red-600">{errors.first_activity_type.message}</p>}
          </div>
          <Input label="Data e hora" type="datetime-local" error={errors.first_activity_due_at?.message} {...register('first_activity_due_at')} />
        </div>
      </div>

      <label className="block text-sm font-medium text-ink mb-1.5">Observações</label>
      <Textarea rows={3} {...register('commercial_notes')} placeholder="Notas sobre o lead..." />

      <div className="flex justify-end gap-3 pt-2">
        {identityConflict && (
          <div className="mb-3 flex w-full flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span role="alert">{possibleDuplicateMessage(identityConflict)}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setIdentityConflict(null)}>
                Revisar dados
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleSubmit(onSubmitForced)()
                }}
              >
                Criar lead mesmo assim
              </Button>
            </div>
          </div>
        )}
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          <Save className="size-4" /> Criar lead
        </Button>
      </div>
    </form>
  )
}
