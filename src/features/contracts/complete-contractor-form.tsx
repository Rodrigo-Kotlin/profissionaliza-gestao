import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button, Input } from '@/components/ui/core'
import { useUpdatePerson } from './contracts-hooks'
import { useCepLookup } from './use-cep-lookup'
import { CONTRACTOR_FIELD_LABELS, type ContractorField } from './contractor-data'
import { normalizePhone } from '../students/students-utils'

const loose = (max: number) => z.union([z.string().trim().max(max), z.literal('')]).optional()

const completionSchema = z.object({
  full_name: z
    .union([z.string().trim().min(3, 'Informe o nome completo.').max(240), z.literal('')])
    .optional(),
  preferred_name: loose(120),
  birth_date: z.union([z.string(), z.literal('')]).optional(),
  phone: loose(24).refine(
    (v) => !v || normalizePhone(v).length >= 10,
    { message: 'Telefone incompleto (mínimo DDD + número).' }
  ),
  whatsapp: loose(24).refine(
    (v) => !v || normalizePhone(v).length >= 10,
    { message: 'WhatsApp incompleto (mínimo DDD + número).' }
  ),
  email: loose(320).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: 'E-mail inválido.' }
  ),
  postal_code: loose(12),
  street: loose(180),
  number: loose(20),
  complement: loose(120),
  district: loose(120),
  city: loose(120),
  state: loose(2).refine(
    (v) => !v || /^[A-Za-z]{2}$/.test(v),
    { message: 'Estado inválido.' }
  )
})

type CompletionValues = z.infer<typeof completionSchema>

type Props = {
  personId: string
  missing: ContractorField[]
  onCompleted: () => void
}

const FULL_WIDTH_FIELDS = new Set(['full_name', 'street'])

export function CompleteContractorForm({ personId, missing, onCompleted }: Props) {
  const updatePerson = useUpdatePerson()
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors }
  } = useForm<CompletionValues>({
    resolver: zodResolver(completionSchema),
    defaultValues: missing.reduce((acc, f) => ({ ...acc, [f]: '' }), {})
  })

  const postalCodeValue = useWatch({ control, name: 'postal_code' })
  const cepLookup = useCepLookup(postalCodeValue, {
    onFound: (address) => {
      setValue('postal_code', address.postal_code, { shouldValidate: false })
      if (missing.includes('street')) setValue('street', address.street, { shouldValidate: false })
      if (missing.includes('district')) setValue('district', address.district, { shouldValidate: false })
      if (missing.includes('city')) setValue('city', address.city, { shouldValidate: false })
      if (missing.includes('state')) setValue('state', address.state, { shouldValidate: false })
      toast.success('Endereço localizado pelo CEP. Revise os campos preenchidos.')
    }
  })

  const onSubmit = async (values: CompletionValues) => {
    try {
      await updatePerson.mutateAsync({
        person_id: personId,
        ...(values.full_name != null && values.full_name !== '' ? { full_name: values.full_name } : {}),
        ...(missing.includes('preferred_name') ? { preferred_name: values.preferred_name ?? undefined } : {}),
        ...(missing.includes('birth_date') ? { birth_date: values.birth_date ?? undefined } : {}),
        ...(missing.includes('phone') ? { phone: values.phone ?? undefined } : {}),
        ...(missing.includes('whatsapp') ? { whatsapp: values.whatsapp ?? undefined } : {}),
        ...(missing.includes('email') ? { email: values.email ?? undefined } : {}),
        ...(missing.includes('postal_code') ? { postal_code: values.postal_code ?? undefined } : {}),
        ...(missing.includes('street') ? { street: values.street ?? undefined } : {}),
        ...(missing.includes('number') ? { number: values.number ?? undefined } : {}),
        ...(missing.includes('complement') ? { complement: values.complement ?? undefined } : {}),
        ...(missing.includes('district') ? { district: values.district ?? undefined } : {}),
        ...(missing.includes('city') ? { city: values.city ?? undefined } : {}),
        ...(missing.includes('state') ? { state: values.state ?? undefined } : {})
      })
      toast.success('Dados do contratante atualizados.')
      onCompleted()
    } catch {
      toast.error('Não foi possível atualizar os dados do contratante.')
    }
  }

  const cepStatusText =
    cepLookup.status === 'loading'
      ? 'Consultando CEP...'
      : cepLookup.status === 'not_found'
        ? 'CEP não encontrado. Preencha o endereço manualmente.'
        : cepLookup.status === 'error'
          ? 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'
          : cepLookup.status === 'invalid'
            ? 'CEP com formato inválido.'
            : null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Completar dados do contratante">
      <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-semibold">Dados do contratante incompletos</p>
          <p>Complete apenas os campos abaixo. Os demais já estão registrados e serão mantidos.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {missing.map((field) => (
          <div key={field} className={FULL_WIDTH_FIELDS.has(field) ? 'sm:col-span-2' : ''}>
            <Input
              label={`${CONTRACTOR_FIELD_LABELS[field]} *`}
              type={field === 'birth_date' ? 'date' : field === 'email' ? 'email' : 'text'}
              inputMode={field === 'phone' || field === 'whatsapp' || field === 'postal_code' ? 'numeric' : undefined}
              error={errors[field]?.message}
              {...register(field)}
            />
            {field === 'postal_code' && cepStatusText && cepLookup.status !== 'found' && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                {cepLookup.status === 'loading' && <Loader2 className="size-3 animate-spin" />}
                {cepStatusText}
              </p>
            )}
            {field === 'postal_code' && cepLookup.status === 'found' && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3" /> Endereço localizado pelo CEP.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          variant="gold"
          loading={updatePerson.isPending}
          disabled={updatePerson.isPending}
        >
          Salvar dados do contratante
        </Button>
      </div>
    </form>
  )
}