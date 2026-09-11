import { Search, UserPlus, X, Users } from 'lucide-react'
import { useState } from 'react'
import { Button, Input } from '@/components/ui/core'
import { useSearchContractorPeople } from './contracts-hooks'
import { CreatePersonModal } from './create-person-modal'
import type { ContractorSearchResult } from './contracts-types'

export type SelectedContractor = Pick<ContractorSearchResult, 'id' | 'full_name' | 'preferred_name'> & {
  reused?: boolean
}

type Props = {
  canCreate: boolean
  selected?: SelectedContractor | null
  onSelect: (person: SelectedContractor) => void
}

export function ContractorSearch({ canCreate, selected, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const search = useSearchContractorPeople(query.trim())

  const results = search.data?.data ?? []
  const showResults = query.trim().length >= 2
  const isLoading = search.isLoading
  const hasSearchTerm = query.trim().length === 1

  return (
    <div className="space-y-3">
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

      {hasSearchTerm && (
        <p className="text-xs text-muted">Digite ao menos 2 caracteres para buscar.</p>
      )}

      {!selected && canCreate && (
        <Button type="button" variant="secondary" className="w-full" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" /> Cadastrar novo contratante
        </Button>
      )}

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-navy-50/60 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{selected.full_name}</p>
            {selected.preferred_name && <p className="truncate text-xs text-muted">{selected.preferred_name}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { onSelect({ id: '', full_name: '', preferred_name: null }); setQuery('') }}
          >
            Trocar
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-xs text-muted">Buscando...</p>
      ) : (showResults && results.length === 0) || (!showResults && query.trim() !== '') ? (
        <p className="text-xs text-muted">
          Nenhum resultado. {canCreate ? 'Cadastre um novo contratante.' : 'Solicite o cadastro do contratante à Recepção ou Administração.'}
        </p>
      ) : null}

      {selected && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted">
          <Users className="mt-0.5 size-4 shrink-0" />
          <span>O contratante poderá ser trocado enquanto o contrato estiver em rascunho.</span>
        </div>
      )}

      {showResults && results.length > 0 && (
        <ul className="space-y-2" role="listbox" aria-label="Resultados da busca">
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected?.id === person.id}
                onClick={() => onSelect(person)}
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

      <CreatePersonModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(person) => { onSelect(person); setQuery('') }}
      />
    </div>
  )
}