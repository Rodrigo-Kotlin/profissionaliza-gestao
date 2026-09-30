export function normalizeCepDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export type CepAddress = {
  postal_code: string
  street: string
  district: string
  city: string
  state: string
}

export type CepLookupResult =
  | { ok: true; address: CepAddress }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'invalid' }
  | { ok: false; error: 'unavailable' }

export type CepProvider = (cep: string, signal?: AbortSignal) => Promise<CepAddress | null>

const VIA_CEP_URL = 'https://viacep.com.br/ws'

async function viaCepProvider(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const res = await fetch(`${VIA_CEP_URL}/${cep}/json/`, { signal })
  if (!res.ok) {
    // viaCEP returns 400 for invalid formats; treat as not found/unsuccessful.
    if (res.status === 400) return null
    throw new Error(`CEP provider returned ${res.status}`)
  }
  const body = (await res.json()) as {
    erro?: boolean
    logradouro?: string
    bairro?: string
    localidade?: string
    uf?: string
    cep?: string
  }
  if (body.erro) return null
  if (!body.cep || !body.localidade || !body.uf) return null
  return {
    postal_code: body.cep.replace(/\D/g, ''),
    street: body.logradouro ?? '',
    district: body.bairro ?? '',
    city: body.localidade,
    state: body.uf
  }
}

export const cepProviders: Record<string, CepProvider> = {
  viacep: viaCepProvider
}

export const defaultCepProvider: CepProvider = viaCepProvider

export type LookupCepParams = {
  cep: string
  provider?: CepProvider
  signal?: AbortSignal
}

export async function lookupCep({
  cep,
  provider = defaultCepProvider,
  signal
}: LookupCepParams): Promise<CepLookupResult> {
  const normalized = normalizeCepDigits(cep)
  if (normalized.length !== 8) {
    return { ok: false, error: 'invalid' }
  }

  try {
    const address = await provider(normalized, signal)
    if (!address) {
      return { ok: false, error: 'not_found' }
    }
    return { ok: true, address }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}