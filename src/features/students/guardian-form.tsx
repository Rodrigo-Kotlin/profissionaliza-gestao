import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button, Checkbox, Input, Select, Textarea } from '@/components/ui/core'
import { GUARDIAN_RELATIONSHIPS, GUARDIAN_RELATIONSHIP_LABELS } from '@/lib/rbac'
import { guardianSchema, type GuardianFormValues } from './students-schemas'
import { useLinkGuardian } from './students-hooks'
import { normalizeCpf, normalizeEmail, normalizePhone } from './students-utils'

export function GuardianForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const linkGuardian = useLinkGuardian(studentId)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<GuardianFormValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: { relationship: 'OUTRO', is_primary_contact: false, is_financial_responsible: false, is_legal_guardian: false }
  })

  const onSubmit = async (values: GuardianFormValues) => {
    try {
      await linkGuardian.mutateAsync({
        full_name: values.full_name,
        cpf: values.cpf ? normalizeCpf(values.cpf) : undefined,
        relationship: values.relationship,
        phone: values.phone ? normalizePhone(values.phone) : undefined,
        whatsapp: values.whatsapp ? normalizePhone(values.whatsapp) : undefined,
        email: values.email ? normalizeEmail(values.email) : undefined,
        is_primary_contact: Boolean(values.is_primary_contact),
        is_financial_responsible: Boolean(values.is_financial_responsible),
        is_legal_guardian: Boolean(values.is_legal_guardian),
        notes: values.notes
      })
      onDone()
    } catch (err) {
      toast.error(err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Não foi possível vincular o responsável.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Nome completo *" error={errors.full_name?.message} {...register('full_name')} />
      <Input label="CPF" inputMode="numeric" placeholder="000.000.000-00" error={errors.cpf?.message} {...register('cpf')} />
      <Input label="Telefone" inputMode="tel" error={errors.phone?.message} {...register('phone')} />
      <Input label="WhatsApp" inputMode="tel" error={errors.whatsapp?.message} {...register('whatsapp')} />
      <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="relationship">Parentesco *</label>
        <Select id="relationship" {...register('relationship')}>
          {GUARDIAN_RELATIONSHIPS.map((rel) => (
            <option key={rel} value={rel}>{GUARDIAN_RELATIONSHIP_LABELS[rel]}</option>
          ))}
        </Select>
        {errors.relationship && <p className="mt-1 text-xs text-red-600">{errors.relationship.message}</p>}
      </div>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-xs font-semibold">Papel do responsável</legend>
        <label className="flex min-h-9 items-center gap-2 text-sm"><Checkbox {...register('is_primary_contact')} /> Contato principal</label>
        <label className="flex min-h-9 items-center gap-2 text-sm"><Checkbox {...register('is_financial_responsible')} /> Responsável financeiro</label>
        <label className="flex min-h-9 items-center gap-2 text-sm"><Checkbox {...register('is_legal_guardian')} /> Responsável legal</label>
      </fieldset>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-ink" htmlFor="guardian-notes">Observações</label>
        <Textarea id="guardian-notes" rows={3} placeholder="Observações" {...register('notes')} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
          <UserPlus className="size-4" /> {isSubmitting ? 'Vinculando...' : 'Vincular responsável'}
        </Button>
      </div>
    </form>
  )
}