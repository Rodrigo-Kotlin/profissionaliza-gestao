import { Badge } from '@/components/ui/core'
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_TONES } from './enrollment-constants'
import type { EnrollmentStatus } from './enrollment-types'

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  return <Badge variant={ENROLLMENT_STATUS_TONES[status]}>{ENROLLMENT_STATUS_LABELS[status]}</Badge>
}
