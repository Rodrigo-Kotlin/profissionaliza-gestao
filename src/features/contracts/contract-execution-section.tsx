import { CheckCircle2, Download, FileCheck2, FileUp, ShieldCheck, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, Input, Select, Textarea } from '@/components/ui/core'
import { offlineAwareMessage } from '@/lib/offline'
import { can, PERMISSIONS } from '@/lib/rbac'
import {
  useCompleteContractExecution,
  useContractExecutions,
  useCreateContractExecution,
  useDownloadContractExecution,
  useRejectContractExecution,
  useUploadContractExecution,
  useVerifyContractExecution
} from './contracts-hooks'
import type { ContractDetail, ContractDocumentListItem, ContractExecution, ContractExecutionMethod } from './contracts-types'

const methodLabels: Record<ContractExecutionMethod, string> = {
  GOV_BR: 'Gov.br: conferência manual no VALIDAR ITI',
  PHYSICAL: 'Assinatura presencial'
}

const statusLabels: Record<ContractExecution['status'], string> = {
  PENDING_UPLOAD: 'Aguardando PDF',
  RECEIVED: 'Recebido, aguardando conferência',
  VERIFIED: 'Conferido',
  REJECTED: 'Rejeitado'
}

export function ContractExecutionSection({
  contract,
  document,
  permissions
}: {
  contract: ContractDetail
  document: ContractDocumentListItem
  permissions: readonly string[]
}) {
  const executions = useContractExecutions(document.document_id)
  const create = useCreateContractExecution(contract.contract_id, document.document_id)
  const upload = useUploadContractExecution(contract.contract_id, document.document_id)
  const verify = useVerifyContractExecution(contract.contract_id, document.document_id)
  const reject = useRejectContractExecution(contract.contract_id, document.document_id)
  const complete = useCompleteContractExecution(contract.contract_id, document.document_id)
  const download = useDownloadContractExecution()
  const [method, setMethod] = useState<ContractExecutionMethod>('GOV_BR')
  const [signedDate, setSignedDate] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [verificationDate, setVerificationDate] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const active = executions.data?.data.find((item) => ['PENDING_UPLOAD', 'RECEIVED', 'VERIFIED'].includes(item.status))
  const latestRejected = !active ? executions.data?.data.find((item) => item.status === 'REJECTED') : undefined
  const canUpload = can(permissions, PERMISSIONS.CONTRACTS_EXECUTION_UPLOAD) && can(permissions, PERMISSIONS.CONTRACTS_VIEW_SENSITIVE)
  const canVerify = can(permissions, PERMISSIONS.CONTRACTS_EXECUTION_VERIFY) && can(permissions, PERMISSIONS.CONTRACTS_VIEW_SENSITIVE)
  const canReject = can(permissions, PERMISSIONS.CONTRACTS_EXECUTION_REJECT)
  const canComplete = can(permissions, PERMISSIONS.CONTRACTS_MARK_SIGNED)

  const dateToIso = (date: string) => date ? new Date(`${date}T12:00:00`).toISOString() : null

  const createExecution = async () => {
    try {
      await create.mutateAsync({
        execution_method: method,
        signer_person_id: contract.contractor_person_id,
        signer_name_snapshot: contract.contractor_name,
        signed_at: dateToIso(signedDate)
      })
      toast.success('Recebimento preparado. Envie o PDF assinado.')
    } catch (error) {
      toast.error(offlineAwareMessage(error, 'Não foi possível preparar o recebimento.'))
    }
  }

  const uploadExecution = async () => {
    if (!active || !selectedFile) return
    try {
      await upload.mutateAsync({ execution_id: active.execution_id, file: selectedFile })
      setSelectedFile(null)
      toast.success('PDF recebido com SHA-256 calculado no servidor.')
    } catch (error) {
      toast.error(offlineAwareMessage(error, 'Não foi possível receber o PDF.'))
    }
  }

  const verifyExecution = async () => {
    const confirmedDate = verificationDate || active?.signed_at?.slice(0, 10) || ''
    if (!active || active.status !== 'RECEIVED' || !confirmedDate) return
    try {
      await verify.mutateAsync({
        execution_id: active.execution_id,
        verification_method: active.execution_method === 'GOV_BR' ? 'GOV_BR_VALIDAR_MANUAL' : 'PHYSICAL_IN_PERSON',
        signed_at: dateToIso(confirmedDate)!,
        verification_notes: verificationNotes || null,
        evidence_json: active.execution_method === 'GOV_BR' ? { source: 'VALIDAR_ITI_MANUAL', result: 'CONFIRMED' } : { source: 'IN_PERSON', result: 'CONFIRMED' }
      })
      toast.success('Formalização conferida. O contrato pode ser concluído.')
    } catch (error) {
      toast.error(offlineAwareMessage(error, 'Não foi possível conferir a formalização.'))
    }
  }

  const rejectExecution = async () => {
    if (!active || active.status !== 'RECEIVED' || !rejectionReason.trim()) return
    try {
      await reject.mutateAsync({ execution_id: active.execution_id, rejection_reason: rejectionReason.trim() })
      setRejectionReason('')
      toast.success('Formalização rejeitada.')
    } catch (error) {
      toast.error(offlineAwareMessage(error, 'Não foi possível rejeitar a formalização.'))
    }
  }

  const completeExecution = async () => {
    if (!active) return
    try {
      await complete.mutateAsync(active.execution_id)
      toast.success('Contrato assinado e matrícula criada como pendente.')
    } catch (error) {
      toast.error(offlineAwareMessage(error, 'Não foi possível concluir o contrato.'))
    }
  }

  const downloadExecution = async () => {
    if (!active) return
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer')
    try {
      const result = await download.mutateAsync(active.execution_id)
      if (popup) popup.location.href = result.signed_url
      else window.location.href = result.signed_url
    } catch (error) {
      popup?.close()
      toast.error(offlineAwareMessage(error, 'Não foi possível abrir o PDF assinado.'))
    }
  }

  if (contract.status === 'SIGNED' && !active) {
    return <Card className="p-5"><p className="text-sm text-muted">Contrato legado ou sem execução documental registrada nesta versão.</p></Card>
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-navy" /><h2 className="text-sm font-semibold">Formalização da assinatura</h2></div>
          <p className="mt-1 text-sm text-muted">O PDF assinado é recebido em armazenamento privado e só muda o contrato após conferência humana.</p>
        </div>
        {active ? <Badge variant={active.status === 'VERIFIED' ? 'success' : active.status === 'REJECTED' ? 'danger' : 'warning'}>{statusLabels[active.status]}</Badge> : latestRejected && <Badge variant="danger">{statusLabels.REJECTED}</Badge>}
      </div>

      {!active && canUpload && contract.status === 'PENDING_SIGNATURE' && (
        <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-navy/20 bg-navy-50/40 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
           <label className="space-y-1.5 text-sm font-medium">Método<Select value={method} onChange={(event) => setMethod(event.target.value as ContractExecutionMethod)}><option value="GOV_BR">{methodLabels.GOV_BR}</option><option value="PHYSICAL">{methodLabels.PHYSICAL}</option></Select></label>
           <Input label="Data da assinatura" type="date" value={signedDate} onChange={(event) => setSignedDate(event.target.value)} />
           <Button loading={create.isPending} disabled={create.isPending || !signedDate} onClick={createExecution}><FileUp className="size-4" />Preparar recebimento</Button>
           <p className="text-xs font-normal text-muted md:col-span-2">{method === 'GOV_BR' ? 'Assine o PDF pelo Gov.br e envie o arquivo assinado.' : 'Assinatura presencial: envie o PDF assinado para conferência.'}</p>
         </div>
      )}

      {active?.status === 'PENDING_UPLOAD' && canUpload && (
        <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-gold/50 bg-gold/5 p-4 md:grid-cols-[1fr_auto] md:items-end">
           <label className="min-w-0 space-y-1.5 text-sm font-medium">PDF assinado<input type="file" accept="application/pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="block min-h-11 min-w-0 w-full rounded-lg border bg-white px-3 py-2 text-sm" /><span className="block text-xs font-normal text-muted">Somente PDF, até 20 MiB. O arquivo será validado por MIME, assinatura `%PDF-` e SHA-256.</span></label>
          <Button loading={upload.isPending} disabled={upload.isPending || !selectedFile} onClick={uploadExecution}><FileUp className="size-4" />Enviar PDF</Button>
        </div>
      )}

      {active && <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><Row label="Método" value={methodLabels[active.execution_method]} /><Row label="Signatário" value={active.signer_name_snapshot} /><Row label="Arquivo" value={active.signed_file_name ?? 'Ainda não enviado'} /><Row label="SHA-256" value={active.signed_sha256 ? `${active.signed_sha256.slice(0, 12)}…` : 'Calculado ao receber'} /></div>}

      {active?.status === 'RECEIVED' && (
        <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-2">
          {canVerify && <div className="space-y-3"><p className="font-semibold">Conferência</p><Input label="Data da assinatura confirmada" type="date" value={verificationDate || active.signed_at?.slice(0, 10) || ''} onChange={(event) => setVerificationDate(event.target.value)} /><Textarea rows={3} placeholder="Observações da conferência (opcional)" value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} /><Button loading={verify.isPending} disabled={verify.isPending || !(verificationDate || active.signed_at)} onClick={() => void verifyExecution()}><FileCheck2 className="size-4" />Confirmar conferência</Button></div>}
          {canReject && <div className="space-y-3"><p className="font-semibold">Recusar arquivo</p><Textarea rows={3} placeholder="Motivo obrigatório da rejeição" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /><Button variant="danger" loading={reject.isPending} disabled={reject.isPending || !rejectionReason.trim()} onClick={rejectExecution}><XCircle className="size-4" />Rejeitar</Button></div>}
        </div>
      )}

      {active && ['RECEIVED', 'VERIFIED'].includes(active.status) && <Button variant="secondary" className="mt-4" loading={download.isPending} disabled={download.isPending} onClick={downloadExecution}><Download className="size-4" />Baixar PDF assinado</Button>}
      {active?.status === 'VERIFIED' && canComplete && <div className="mt-4 border-t pt-4"><p className="mb-2 text-sm text-muted">A conferência está registrada. Esta ação grava `SIGNED` e cria a matrícula em `PENDING` na mesma transação.</p><Button loading={complete.isPending} disabled={complete.isPending} onClick={completeExecution}><CheckCircle2 className="size-4" />Concluir contrato</Button></div>}
      {latestRejected && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">Última tentativa rejeitada. Motivo: {latestRejected.rejection_reason ?? 'Não informado.'} É possível preparar uma nova tentativa.</p>}
      {executions.isLoading && <p className="mt-4 text-sm text-muted">Consultando formalizações...</p>}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-2"><span className="shrink-0 text-muted">{label}</span><span className="min-w-0 break-words text-right font-medium">{value}</span></div>
}
