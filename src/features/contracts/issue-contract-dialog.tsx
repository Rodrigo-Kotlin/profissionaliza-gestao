import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useIssueContract } from './contracts-hooks'
import type { ContractDetail } from './contracts-types'

type Props = {
  contract: ContractDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onIssued?: () => void
}

export function IssueContractDialog({ contract, open, onOpenChange, onIssued }: Props) {
  const issue = useIssueContract()
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    try {
      const result = await issue.mutateAsync(contract.contract_id)
      toast.success(`Contrato ${result.contract_code} emitido.`)
      onOpenChange(false)
      onIssued?.()
    } catch {
      setError('Não foi possível emitir o contrato.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Emitir ${contract.contract_code}`}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Após a emissão, o contrato passa para <span className="font-semibold text-ink">Aguardando assinatura</span> e nenhum dado poderá mais ser alterado.
        </p>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          Confira os dados antes de emitir: valores, condições, curso e contratante ficarão congelados.
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button type="button" loading={issue.isPending} disabled={issue.isPending} onClick={onSubmit}>
            Confirmar emissão
          </Button>
        </div>
      </div>
    </Modal>
  )
}