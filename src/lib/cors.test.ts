import { describe, expect, it } from 'vitest'
import { corsHeaders, isAllowedOrigin, originIsPresentAndDenied } from '../../supabase/functions/_shared/cors'

describe('CORS origin policy', () => {
  it('allows the production origin', () => {
    expect(isAllowedOrigin('https://profissionaliza-gestao.pages.dev')).toBe(true)
  })

  it('allows a single-label Pages preview hostname', () => {
    expect(isAllowedOrigin('https://a528d86a.profissionaliza-gestao.pages.dev')).toBe(true)
  })

  it('rejects unknown and similar domains', () => {
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false)
    expect(isAllowedOrigin('https://profissionaliza-gestao.pages.dev.evil.example')).toBe(false)
    expect(isAllowedOrigin('https://profissionaliza-gestao.pages.dev.attacker')).toBe(false)
    expect(isAllowedOrigin('https://nested.preview.profissionaliza-gestao.pages.dev')).toBe(false)
    expect(isAllowedOrigin('http://profissionaliza-gestao.pages.dev')).toBe(false)
  })

  it('does not emit an allow origin for server-to-server requests', () => {
    expect(originIsPresentAndDenied(null)).toBe(false)
    expect(corsHeaders(null)['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('echoes only an allowed origin', () => {
    expect(corsHeaders('https://profissionaliza-gestao.pages.dev')['Access-Control-Allow-Origin'])
      .toBe('https://profissionaliza-gestao.pages.dev')
    expect(originIsPresentAndDenied('https://evil.example.com')).toBe(true)
  })
})
