import { CheckCircle2, Search, UserPlus, Users, X, AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Input } from '@/components/ui/core'
import { useSearchContractorPeople } from './contracts-hooks'
import { CreatePersonModal } from './create-person-modal'
import { CompleteContractorForm } from './complete-contractor-form'
import { getContractorCompleteness } from './contractor-data'
import { useStudentGuardians } from '../students/students-hooks'
import type { ContractorSearchResult, ContractorDetail } from './contracts-types'

export type SelectedContractor = Pick<ContractorSearchResult, 'id' | 'full_name' | 'preferred_name'> & {
  reused?: boolean
}

type Props = {
  canCreate: boolean
  canEditPeople?: boolean
  canViewGuardians?: boolean
  studentId?: string
  selected?: SelectedContractor | null
  onSelect: (person: SelectedContractor) => void
  detail?: ContractorDetail | null
  detailLoading?: boolean
  onDetailUpdated?: () => void
}

export function ContractorSearch({
  canCreate,
  canEditPeople,
  canViewGuardians,
  studentId,
  selected,
  onSelect,
  detail,
  detailLoading,
  onDetailUpdated
}: Props) {
  const [switching, setSwitching] = useState(false)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const search = useSearchContractorPeople(query.trim())
  const guardians = useStudentGuardians(canViewGuardians && studentId ? studentId : '')

  const results = search.data?.data ?? []
  const showResults = query.trim().length >= 2
  const hasSearchTerm = query.trim().length === 1
  const isLoading = search.isLoading

  const pick = (person: SelectedContractor) => {
    onSelect(person)
    setSwitching(false)
    setQuery('')
  }

  const completeness = detail ? getContractorCompleteness(detail) : null

  return (
    <div className="space-y-3">
      {selected && !switching ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 rounded-lg border bg-navy-50/60 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{selected.full_name}</p>
              {selected.preferred_name && (
                <p className="truncate text-xs text-muted">Prefere ser chamado(a) de {selected.preferred_name}</p>
              )}
              {detailLoading && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Loader2 className="size-3 animate-spin" /> Carregando dados do contratante...</p>}
              {!detailLoading && detail && (
                <p className="mt-1 truncate text-xs text-muted">
                  CPF {detail.cpf ?? '—'} · {detail.email ?? detail.phone ?? 'contato não informado'}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">{selected.reused ? 'Pessoa já cadastrada — dados reutilizados.' : ''}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSwitching(true)}>Trocar</Button>
          </div>

          {detail && canEditPeople && (
            <div className="rounded-md border p-3">
              <ContractorStatusHeader isComplete={completeness?.isComplete ?? false} />
              {!completeness?.isComplete && (
                <div className="mt-2 space-y-2">
                  {completeness?.cpfMissing && (
                    <p className="flex items-start gap-1.5 rounded-md bg-slate-50 p-2 text-xs text-muted">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      CPF pendente — regularização via Recepção ou Administração.
                    </p>
                  )}
                  <CompleteContractorForm
                    personId={selected.id}
                    missing={completeness?.missing ?? []}
                    onCompleted={onDetailUpdated ?? (() => {})}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted">
            <Users className="mt-0.5 size-4 shrink-0" />
            <span>O contratante poderá ser trocado enquanto o contrato estiver em rascunho.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted" />
            <Input
              placeholder="Buscar por nome ou CPF (mínimo 2 caracteres)..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar contratante"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setQuery('')}
                className="absolute right-3 top-2.5 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {hasSearchTerm && <p className="text-xs text-muted">Digite ao menos 2 caracteres para buscar.</p>}

          {!selected && canCreate && (
            <Button type="button" variant="secondary" className="w-full" onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-4" /> Cadastrar novo contratante
            </Button>
          )}

          {canViewGuardians && guardians.data && guardians.data.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                <Users className="size-3.5" /> Responsáveis cadastrados do aluno
              </p>
              <ul className="space-y-2" role="listbox" aria-label="Responsáveis do aluno">
                {guardians.data.map((guardian) => (
                  <li key={guardian.guardian_id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected?.id === guardian.person_id}
                      onClick={() => pick({ id: guardian.person_id, full_name: guardian.full_name, preferred_name: null, reused: true })}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left hover:bg-navy-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{guardian.full_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {guardian.relationship}
                          {guardian.is_financial_responsible ? ' · responsável financeiro' : ''}
                        </span>
                      </span>
                      <span className="text-xs text-muted">Selecionar</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isLoading ? (
            <p className="flex items-center gap-1.5 text-xs text-muted"><Loader2 className="size-3 animate-spin" /> Buscando...</p>
          ) : (showResults && results.length === 0) || (!showResults && query.trim() !== '') ? (
            <p className="text-xs text-muted">
              Nenhum resultado. {canCreate ? 'Cadastre um novo contratante.' : 'Solicite o cadastro do contratante à Recepção ou Administração.'}
            </p>
          ) : null}

          {showResults && results.length > 0 && (
            <ul className="space-y-2" role="listbox" aria-label="Resultados da busca">
              {results.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected?.id === person.id}
                    onClick={() => pick(person)}
                    className="flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left hover:bg-navy-50"
                  >
                    <span className="text-sm font-semibold">{person.full_name}</span>
                    {person.preferred_name && <span className="text-xs text-muted">{person.preferred_name}</span>}
                    <span className="text-xs text-muted">
                      CPF {person.cpf_masked ?? '—'} · {person.phone_masked ?? '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSwitching(false)}>
              <X className="size-4" /> Cancelar troca
            </Button>
          )}
        </>
      )}

      <CreatePersonModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(person) => { pick(person); setQuery('') }}
      />
    </div>
  )
}

function ContractorStatusHeader({ isComplete }: { isComplete: boolean }) {
  if (isComplete) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-4" /> Dados do contratante completos
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
      <AlertTriangle className="size-4" /> Dados do contratante incompletos
    </p>
  )
}