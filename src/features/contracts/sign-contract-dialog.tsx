import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/core'
import { Modal } from '@/components/ui/overlays'
import { useSignContract } from './contracts-hooks'
import type { ContractDetail } from './contracts-types'

type Props = {
  contract: ContractDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSigned?: () => void
}

export function SignContractDialog({ contract, open, onOpenChange, onSigned }: Props) {
  const sign = useSignContract()
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    try {
      const result = await sign.mutateAsync(contract.contract_id)
      toast.success(`Contrato ${result.contract_code} assinado.`)
      onOpenChange(false)
      onSigned?.()
    } catch {
      setError('Não foi possível registrar a assinatura.')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Assinar ${contract.contract_code}`}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Confirme que o contratante assinou o contrato. A assinatura será registrada com a data atual e não poderá ser desfeita.
        </p>

        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
          Contratante: <span className="font-semibold">{contract.contractor_name}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button type="button" loading={sign.isPending} disabled={sign.isPending} onClick={onSubmit}>
            Confirmar assinatura
          </Button>
        </div>
      </div>
    </Modal>
  )
}