import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { studentsService } from './students-service'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock
  }
}))

describe('studentsService — proteção offline em mutations', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true })
  })

  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true })
  })

  it.each([
    ['create', () => studentsService.create({ full_name: 'Teste', origin: 'INSTAGRAM' })],
    ['update', () => studentsService.update('stu-1', { full_name: 'Teste' })],
    ['changeStatus', () => studentsService.changeStatus('stu-1', 'ACTIVE', 'Motivo')],
    ['linkGuardian', () => studentsService.linkGuardian('stu-1', { full_name: 'Parente', relationship: 'PARENT', is_primary_contact: true, is_financial_responsible: false, is_legal_guardian: false })],
    ['unlinkGuardian', () => studentsService.unlinkGuardian('guardian-1')],
  ])('%s lança OfflineConnectionError quando offline', async (_name, fn) => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    await expect(fn()).rejects.toThrow('Sem conexão')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it.each([
    ['list', () => studentsService.list({})],
    ['detail', () => studentsService.detail('stu-1')],
    ['listGuardians', () => studentsService.listGuardians('stu-1')],
    ['history', () => studentsService.history('stu-1')],
  ])('%s não lança offline quando navigator.onLine é false', async (_name, fn) => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    rpcMock.mockResolvedValue({ data: null, error: null })
    await expect(fn()).resolves.not.toThrow()
    expect(rpcMock).toHaveBeenCalled()
  })
})