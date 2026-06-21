/**
 * State machine untuk status claim — di-share antara server
 * (`server/services/claim-serializer.ts`) dan klien.
 *
 * Pertahankan urutan & key konsisten dengan `server/services/claim-serializer.ts`.
 * Jika backend berubah, update kedua file secara sinkron.
 */

export const CLAIM_STATUSES = ['OPEN', 'WAITING_PQA', 'ON_PROGRESS', 'CLOSED'] as const
export type ClaimStatus = typeof CLAIM_STATUSES[number]

const STATUS_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  OPEN: ['WAITING_PQA'],
  WAITING_PQA: ['ON_PROGRESS'],
  ON_PROGRESS: ['CLOSED'],
  CLOSED: []
}

export function allowedNextStatuses(from: ClaimStatus): readonly ClaimStatus[] {
  return STATUS_TRANSITIONS[from] ?? []
}

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}
