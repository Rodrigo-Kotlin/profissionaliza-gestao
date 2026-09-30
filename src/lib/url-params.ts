export type UrlParamUpdate = string | number | undefined | null

export function updateSearchParams(
  current: URLSearchParams,
  updates: Record<string, UrlParamUpdate>
): URLSearchParams {
  const next = new URLSearchParams(current)
  const keys = Object.keys(updates)

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') {
      next.delete(key)
    } else {
      next.set(key, String(value))
    }
  }

  const isPageOnly = keys.length === 1 && keys[0] === 'page'
  if (!isPageOnly) {
    next.delete('page')
  } else if (next.get('page') === '1') {
    next.delete('page')
  }

  return next
}