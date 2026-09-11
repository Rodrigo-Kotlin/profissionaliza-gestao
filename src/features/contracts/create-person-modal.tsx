import { toast } from 'sonner'
import { Button, Input, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useCreatePerson } from './contracts-hooks'
import { personFormSchema } from './contracts-schemas'
import type { ContractorSearchResult, PersonFormPayload } from './contracts-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

type SelectedContractor = Pick<ContractorSearchResult, 'id' | 'full_name' | 'preferred_name'> & {
  reused?: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (person: SelectedContractor) => void
}

export function CreatePersonModal({ open, onOpenChange, onCreated }: Props) {
  const createPerson = useCreatePerson()
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<PersonFormPayload>({
    resolver: zodResolver(personFormSchema)
  })

  const onSubmit = async (values: PersonFormPayload) => {
    try {
      const result = await createPerson.mutateAsync(values)
      const person = {
        id: result.person_id,
        full_name: values.full_name,
        preferred_name: values.preferred_name ?? null,
        reused: result.reused
      }
      toast.success(
        result.reused
          ? 'Pessoa já existia no cadastro.'
          : 'Contratante cadastrado com sucesso.'
      )
      onOpenChange(false)
      reset()
      onCreated(person)
    } catch {
      toast.error('Não foi possível cadastrar o contratante.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Cadastrar contratante">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted">
          Os dados informados são classificados como sensíveis (LGPD) e exibidos apenas conforme sua permissão de visualização.
        </p>

        <Input label="Nome completo *" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Nome preferido" error={errors.preferred_name?.message} {...register('preferred_name')} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="CPF" placeholder="Somente números" error={errors.cpf?.message} {...register('cpf')} />
          <Input label="RG" error={errors.rg?.message} {...register('rg')} />
          <Input label="Nascimento" type="date" error={errors.birth_date?.message} {...register('birth_date')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Telefone" error={errors.phone?.message} {...register('phone')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="WhatsApp" error={errors.whatsapp?.message} {...register('whatsapp')} />
          <Input label="CEP" error={errors.postal_code?.message} {...register('postal_code')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Rua" error={errors.street?.message} {...register('street')} />
          <Input label="Número" error={errors.number?.message} {...register('number')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Complemento" error={errors.complement?.message} {...register('complement')} />
          <Input label="Bairro" error={errors.district?.message} {...register('district')} />
          <Input label="UF (2 letras)" error={errors.state?.message} {...register('state')} />
        </div>

        <Input label="Cidade" error={errors.city?.message} {...register('city')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Contato de emergência" error={errors.emergency_contact_name?.message} {...register('emergency_contact_name')} />
          <Input label="Telefone de emergência" error={errors.emergency_contact_phone?.message} {...register('emergency_contact_phone')} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Observações</label>
          <Textarea rows={2} {...register('notes')} />
          {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>Cadastrar contratante</Button>
        </div>
      </form>
    </Modal>
  )
}