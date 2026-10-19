const PRODUCTION_ORIGIN = 'https://profissionaliza-gestao.pages.dev'
const PREVIEW_HOST_SUFFIX = '.profissionaliza-gestao.pages.dev'

const allowHeaders = 'authorization, x-client-info, apikey, content-type'
const allowMethods = 'POST, OPTIONS'

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false

  try {
    const url = new URL(origin)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
      return false
    }

    return url.origin === PRODUCTION_ORIGIN || (
      url.hostname.endsWith(PREVIEW_HOST_SUFFIX) &&
      url.hostname.slice(0, -PREVIEW_HOST_SUFFIX.length).length > 0 &&
      !url.hostname.slice(0, -PREVIEW_HOST_SUFFIX.length).includes('.')
    )
  } catch {
    return false
  }
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': allowMethods,
    Vary: 'Origin'
  }

  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin!
  return headers
}

export function originIsPresentAndDenied(origin: string | null): boolean {
  return origin !== null && !isAllowedOrigin(origin)
}
