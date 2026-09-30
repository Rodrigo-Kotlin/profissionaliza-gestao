import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { OfflineBanner } from './offline-banner'

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value
  })
}

describe('OfflineBanner — posicionamento abaixo do header (Fase 3)', () => {
  beforeEach(() => {
    setOnline(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não renderiza nada quando online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renderiza ao ficar offline com offset único abaixo do header', () => {
    setOnline(false)
    render(<OfflineBanner />)

    const banner = screen.getByRole('status')
    expect(banner).toBeTruthy()
    expect(banner).toHaveTextContent('Você está sem conexão.')
    expect(banner.className).toContain('app-banner-top')
    expect(banner.className).not.toContain('top-16')
    expect(banner.className).not.toContain('safe-top')
  })

  it('reage aos eventos online/offline sem mudar o posicionamento', async () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).toBeNull()

    await act(async () => {
      setOnline(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(await screen.findByRole('status')).toBeTruthy()

    await act(async () => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})