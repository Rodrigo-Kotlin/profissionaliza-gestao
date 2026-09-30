import { useEffect } from 'react'

export function computeTotalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), Math.max(1, totalPages))
}

export function useNormalizedPage(total: number, page: number, totalPages: number, updatePage: (next: number) => void): void {
  useEffect(() => {
    if (total > 0 && page > totalPages) updatePage(totalPages)
  }, [total, page, totalPages, updatePage])
}