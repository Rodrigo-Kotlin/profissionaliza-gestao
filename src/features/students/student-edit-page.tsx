import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Input, Select, Skeleton, Textarea } from '@/components/ui/core'
import { STUDENT_ORIGINS, STUDENT_ORIGIN_LABELS } from '@/lib/rbac'
import { generateStudentUpdateSchema, type StudentUpdateValues } from './students-schemas'
import { useStudentDetail, useUpdateStudent } from './students-hooks'

export function StudentEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const studentId = id ?? ''
  const detail = useStudentDetail(studentId)
  const updateStudent = useUpdateStudent()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<StudentUpdateValues>({
    resolver: zodResolver(generateStudentUpdateSchema())
  })

  useEffect(() => {
    if (detail.data) {
      reset({
        full_name: detail.data.full_name,
        preferred_name: detail.data.preferred_name ?? '',
        birth_date: detail.data.birth_date ?? '',
        email: detail.data.email ?? '',
        phone: detail.data.phone ?? '',
        whatsapp: detail.data.whatsapp ?? '',
        postal_code: detail.data.postal_code ?? '',
        street: detail.data.street ?? '',
        number: detail.data.number ?? '',
        complement: detail.data.complement ?? '',
        district: detail.data.district ?? '',
        city: detail.data.city ?? '',
        state: detail.data.state ?? '',
        emergency_contact_name: detail.data.emergency_contact_name ?? '',
        emergency_contact_phone: detail.data.emergency_contact_phone ?? '',
        notes: detail.data.notes ?? '',
        origin: detail.data.origin ?? ''
      })
    }
  }, [detail.data, reset])

  const onSubmit = async (values: StudentUpdateValues) => {
    if (!studentId) return
    try {
      await updateStudent.mutateAsync({ id: studentId, input: values })
      navigate(`/alunos/${studentId}`)
    } catch (err) {
      toast.error(err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Não foi possível salvar.')
    }
  }

  if (detail.isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-40" /><Skeleton className="h-80" /></div>
  }
  if (detail.isError || !detail.data) {
    return <Card className="p-6 text-center text-muted">Não foi possível carregar o aluno.</Card>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Dados pessoais</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Nome completo *" error={errors.full_name?.message} {...register('full_name')} />
          <Input label="Nome social" error={errors.preferred_name?.message} {...register('preferred_name')} />
          <Input label="Nascimento" type="date" error={errors.birth_date?.message} {...register('birth_date')} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Contato</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Telefone" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
          <Input label="WhatsApp" inputMode="tel" error={errors.whatsapp?.message} {...register('whatsapp')} />
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Endereço</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="CEP" inputMode="numeric" error={errors.postal_code?.message} {...register('postal_code')} />
          <Input label="Rua" error={errors.street?.message} {...register('street')} />
          <Input label="Número" error={errors.number?.message} {...register('number')} />
          <Input label="Complemento" error={errors.complement?.message} {...register('complement')} />
          <Input label="Bairro" error={errors.district?.message} {...register('district')} />
          <Input label="Cidade" error={errors.city?.message} {...register('city')} />
          <Input label="UF" maxLength={2} error={errors.state?.message} {...register('state')} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Emergência</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Contato de emergência" error={errors.emergency_contact_name?.message} {...register('emergency_contact_name')} />
          <Input label="Telefone de emergência" inputMode="tel" error={errors.emergency_contact_phone?.message} {...register('emergency_contact_phone')} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Informações internas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="origin">Origem</label>
            <Select id="origin" {...register('origin')}>
              <option value="">Selecione a origem</option>
              {STUDENT_ORIGINS.map((value) => (
                <option key={value} value={value}>{STUDENT_ORIGIN_LABELS[value]}</option>
              ))}
            </Select>
            {errors.origin && <p className="mt-1 text-xs text-red-600">{errors.origin.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="notes">Observações</label>
            <Textarea id="notes" rows={3} {...register('notes')} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => navigate(`/alunos/${studentId}`)}>Cancelar</Button>
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting || !isDirty}>
          <Save className="size-4" /> {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}