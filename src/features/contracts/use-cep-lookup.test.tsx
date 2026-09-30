import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useCepLookup } from './use-cep-lookup'

const lookupMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/address/cep-service', () => ({
  lookupCep: lookupMock,
  normalizeCepDigits: (v: string) => v.replace(/\D/g, '')
}))

const foundAddress = { postal_code: '01001000', street: 'Praça da Sé', district: 'Sé', city: 'São Paulo', state: 'SP' }

describe('useCepLookup', () => {
  beforeEach(() => {
    lookupMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stays idle below 8 digits', async () => {
    const { result } = renderHook(() => useCepLookup('12345'))
    await act(async () => {})
    expect(result.current.status).toBe('idle')
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('reports invalid above 8 digits without calling the provider', async () => {
    const { result } = renderHook(() => useCepLookup('123456789'))
    await act(async () => {})
    expect(result.current.status).toBe('invalid')
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('queries the provider once the CEP has 8 digits', async () => {
    lookupMock.mockResolvedValueOnce({ ok: true, address: foundAddress })
    const { result } = renderHook(() => useCepLookup('01001-000', { delayMs: 0 }))
    await waitFor(() => expect(lookupMock).toHaveBeenCalledWith({ cep: '01001000' }))
    await waitFor(() => expect(result.current.status).toBe('found'))
  })

  it('invokes onFound with the resolved address', async () => {
    const onFound = vi.fn()
    lookupMock.mockResolvedValueOnce({ ok: true, address: foundAddress })
    renderHook(() => useCepLookup('01001-000', { delayMs: 0, onFound }))
    await waitFor(() => expect(onFound).toHaveBeenCalledWith(expect.objectContaining({ street: 'Praça da Sé' })))
  })

  it('maps not_found to a manual-fill friendly status', async () => {
    lookupMock.mockResolvedValueOnce({ ok: false, error: 'not_found' })
    const { result } = renderHook(() => useCepLookup('68000000', { delayMs: 0 }))
    await waitFor(() => expect(result.current.status).toBe('not_found'))
  })

  it('maps unavailable to a manual-fill friendly status', async () => {
    lookupMock.mockResolvedValueOnce({ ok: false, error: 'unavailable' })
    const { result } = renderHook(() => useCepLookup('68000000', { delayMs: 0 }))
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('does not refire when status changes without a new CEP value', async () => {
    lookupMock.mockResolvedValueOnce({ ok: true, address: foundAddress })
    const { rerender } = renderHook(({ cep }) => useCepLookup(cep, { delayMs: 0 }), { initialProps: { cep: '68000000' } })
    await waitFor(() => expect(lookupMock).toHaveBeenCalledTimes(1))
    rerender({ cep: '68000000' })
    await act(async () => {})
    expect(lookupMock).toHaveBeenCalledTimes(1)
  })
})