export const PRODUCTION_PROJECT_REF: string

export function assertSafeTarget(input?: {
  environment?: string
  url?: string
  projectRef?: string
  operation?: string
}): { environment: string; projectRef: string }
