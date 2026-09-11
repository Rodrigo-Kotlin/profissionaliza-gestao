import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Textarea } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useUpdateContractDraft } from './contracts-hooks'
import { ContractorSearch, type SelectedContractor } from './contractor-search'
import { can, PERMISSIONS } from '@/lib/rbac'
import { useAuth } from '@/features/auth/auth-context'
import type { ContractDetail } from './contracts-types'

type Props = {
  contract: ContractDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function EditContractDialog({ contract, open, onOpenChange, onSaved }: Props) {
  const { permissions } = useAuth()
  const canCreate = can(permissions, PERMISSIONS.CONTRACTS_CREATE)
  const updateDraft = useUpdateContractDraft()
  const [contractor, setContractor] = useState<SelectedContractor | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setContractor({ id: contract.contractor_person_id, full_name: contract.contractor_name, preferred_name: null })
      setNotes(contract.contract_notes ?? '')
    }
  }, [open, contract])

  const onSubmit = async () => {
    if (!contractor?.id) {
      toast.error('Selecione o contratante.')
      return
    }
    try {
      await updateDraft.mutateAsync({
        contract_id: contract.contract_id,
        contractor_person_id: contractor.id,
        contract_notes: notes
      })
      toast.success(`Contrato ${contract.contract_code} atualizado.`)
      onOpenChange(false)
      onSaved?.()
    } catch {
      toast.error('Não foi possível atualizar o rascunho.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Editar rascunho ${contract.contract_code}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Apenas o contratante e as notas podem ser alterados em rascunho. Valores, curso e condições permanecem conforme a venda.
        </p>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Contratante</label>
          <ContractorSearch canCreate={canCreate} selected={contractor} onSelect={setContractor} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Notas do contrato</label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" loading={updateDraft.isPending} disabled={updateDraft.isPending} onClick={onSubmit}>
            Salvar rascunho
          </Button>
        </div>
      </div>
    </Modal>
  )
}