import { zodResolver } from '@hookform/resolvers/zod'
import { Save, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Input, PageHeader, Select, Textarea } from '@/components/ui/core'
import { STUDENT_ORIGINS, STUDENT_ORIGIN_LABELS } from '@/lib/rbac'
import { generateStudentFormSchema, type StudentFormValues } from './students-schemas'
import { useCreateStudent } from './students-hooks'
import { normalizeCep, normalizeCpf, normalizeEmail, normalizePhone } from './students-utils'

function Field({ label, children, error }: { label: string; children: (id: string) => ReactNode; error?: string }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      {children(id)}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function StudentForm({ defaultValues }: { defaultValues?: Partial<StudentFormValues> }) {
  const navigate = useNavigate()
  const createStudent = useCreateStudent()
  const schema = generateStudentFormSchema()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<StudentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {}
  })

  const onSubmit = async (values: StudentFormValues) => {
    try {
      const id = await createStudent.mutateAsync({
        full_name: values.full_name,
        preferred_name: values.preferred_name,
        cpf: values.cpf ? normalizeCpf(values.cpf) : undefined,
        rg: values.rg,
        birth_date: values.birth_date,
        email: values.email ? normalizeEmail(values.email) : undefined,
        phone: values.phone ? normalizePhone(values.phone) : undefined,
        whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
        postal_code: values.postal_code ? normalizeCep(values.postal_code) : undefined,
        street: values.street,
        number: values.number,
        complement: values.complement,
        district: values.district,
        city: values.city,
        state: values.state,
        emergency_contact_name: values.emergency_contact_name,
        emergency_contact_phone: values.emergency_contact_phone ? normalizePhone(values.emergency_contact_phone) : undefined,
        origin: values.origin,
        notes: values.notes
      })
      toast.success('Aluno criado com sucesso.')
      navigate(`/alunos/${id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title="Novo aluno" description="Preencha os dados para cadastrar o aluno.">
        <Button variant="ghost" onClick={() => navigate('/alunos')}>Cancelar</Button>
      </PageHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Dados pessoais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome completo *" error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Nome social / preferido" error={errors.preferred_name?.message} {...register('preferred_name')} />
            <Input label="CPF" inputMode="numeric" placeholder="000.000.000-00" error={errors.cpf?.message} {...register('cpf')} />
            <Input label="RG" error={errors.rg?.message} {...register('rg')} />
            <Input label="Data de nascimento" type="date" error={errors.birth_date?.message} {...register('birth_date')} />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Contato</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Telefone" inputMode="tel" placeholder="(93) 99999-9999" error={errors.phone?.message} {...register('phone')} />
            <Input label="WhatsApp" inputMode="tel" placeholder="(93) 99999-9999" error={errors.whatsapp?.message} {...register('whatsapp')} />
            <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Endereço</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="CEP" inputMode="numeric" error={errors.postal_code?.message} {...register('postal_code')} />
            <Input label="Logradouro" error={errors.street?.message} {...register('street')} />
            <Input label="Número" error={errors.number?.message} {...register('number')} />
            <Input label="Complemento" error={errors.complement?.message} {...register('complement')} />
            <Input label="Bairro" error={errors.district?.message} {...register('district')} />
            <Input label="Cidade" error={errors.city?.message} {...register('city')} />
            <div className="grid grid-cols-2 gap-4 sm:col-span-2">
              <Input label="UF" maxLength={2} error={errors.state?.message} {...register('state')} />
              <Input label="País" defaultValue="Brasil" disabled />
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Contato de emergência</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome" error={errors.emergency_contact_name?.message} {...register('emergency_contact_name')} />
            <Input label="Telefone" inputMode="tel" error={errors.emergency_contact_phone?.message} {...register('emergency_contact_phone')} />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Informações internas</h2>
          <div className="space-y-4">
            <Field label="Origem">
              {(id) => (
                <Select id={id} {...register('origin')}>
                  <option value="">Selecione a origem</option>
                  {STUDENT_ORIGINS.map((value) => (
                    <option key={value} value={value}>{STUDENT_ORIGIN_LABELS[value]}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Observações">
              {(id) => <Textarea id={id} rows={4} {...register('notes')} />}
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate('/alunos')}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? <span className="flex items-center gap-2"><UserPlus className="size-4" /> Salvando...</span> : <span className="flex items-center gap-2"><Save className="size-4" /> Salvar aluno</span>}
          </Button>
        </div>
      </form>
    </div>
  )
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Não foi possível salvar. Tente novamente.'
}