import { describe, expect, it } from 'vitest'
import { assertSafeTarget, PRODUCTION_PROJECT_REF } from '../../scripts/lib/assert-safe-target.mjs'

describe('assertSafeTarget', () => {
  it('allows a local development target', () => {
    expect(assertSafeTarget({ environment: 'development', url: 'http://127.0.0.1:54321', operation: 'fixture' }).projectRef).toBe('local')
  })

  it.each([
    [{ environment: 'production', url: 'http://127.0.0.1:54321' }, 'only development'],
    [{ environment: 'development', url: `https://${PRODUCTION_PROJECT_REF}.supabase.co` }, 'production project ref'],
    [{ environment: 'development', url: 'https://unknownprojectref.supabase.co' }, 'unknown Supabase project ref'],
    [{ environment: undefined, url: 'http://127.0.0.1:54321' }, 'environment is required']
  ])('denies unsafe target %j', (target, message) => {
    expect(() => assertSafeTarget({ ...target, operation: 'fixture' })).toThrow(message)
  })
})
