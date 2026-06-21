/**
 * Tipe-tipe domain untuk modul Claims.
 *
 * Field-field di sini mengikuti `server/database/schema/claim.ts` dan
 * `doc/backend.md`. Serializer di API endpoint akan memetakan `timestamp_ms`
 * Drizzle menjadi ISO string (lihat `serializeClaim` di route handler).
 */

export const CLAIM_STATUSES = ['OPEN', 'WAITING_PQA', 'ON_PROGRESS', 'CLOSED'] as const
export type ClaimStatus = typeof CLAIM_STATUSES[number]

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  OPEN: 'Open',
  WAITING_PQA: 'Waiting PQA',
  ON_PROGRESS: 'On Progress',
  CLOSED: 'Closed'
}

export const CLAIM_STATUS_COLOR: Record<ClaimStatus, 'info' | 'warning' | 'primary' | 'success' | 'neutral'> = {
  OPEN: 'info',
  WAITING_PQA: 'warning',
  ON_PROGRESS: 'primary',
  CLOSED: 'success'
}

/**
 * Filter status untuk UI. 'all' = tanpa filter.
 * Dipakai oleh komponen USelect.
 */
export const CLAIM_STATUS_FILTER_OPTIONS = [
  { label: 'Semua status', value: 'all' },
  { label: CLAIM_STATUS_LABEL.OPEN, value: 'OPEN' },
  { label: CLAIM_STATUS_LABEL.WAITING_PQA, value: 'WAITING_PQA' },
  { label: CLAIM_STATUS_LABEL.ON_PROGRESS, value: 'ON_PROGRESS' },
  { label: CLAIM_STATUS_LABEL.CLOSED, value: 'CLOSED' }
] as const

export type ClaimStatusFilter = 'all' | ClaimStatus

export interface Claim {
  id: number
  /** Format CLM-YYYY-NNN. Di-generate otomatis oleh service layer. */
  claimCode: string
  productId: number
  productName: string | null
  productCode: string | null
  modelId: number
  modelName: string | null
  modelSku: string | null
  defectId: number
  defectName: string | null
  defectCode: string | null
  source: string
  description: string
  status: ClaimStatus
  createdBy: string
  createdByName: string | null
  updatedBy: string
  updatedByName: string | null
  createdAt: string
  updatedAt: string
  /** Jumlah Issue Photos (entity_type='claim' pada tabel attachments). */
  photoCount: number
  /** Jumlah progress log (jurnal progres). */
  progressLogCount: number
}

/** Payload untuk create claim — disubmit dari Form Create Claim. */
export interface ClaimCreatePayload {
  productId: number
  modelId: number
  defectId: number
  source: string
  description: string
}

export interface ClaimUpdatePayload extends ClaimCreatePayload {
  id: number
}

/** Payload update status — digabung dengan Task 1.6 (state machine). */
export interface ClaimStatusUpdatePayload {
  id: number
  status: ClaimStatus
}

export interface ClaimProgressLog {
  id: number
  claimId: number
  /** Unix timestamp ms (bisa backdate). */
  progressDate: string
  /** HTML string dari WYSIWYG editor. */
  notes: string
  createdBy: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface ClaimProgressLogCreatePayload {
  claimId: number
  progressDate: number // unix ms
  notes: string
}

/**
 * Issue Photo (polymorphic attachment dengan entity_type='claim').
 * Tipe ini digunakan untuk render section Issue Photos di Detail Claim (Task 2.6).
 */
export interface IssuePhoto {
  id: number
  entityType: 'claim'
  entityId: number
  fileName: string
  filePath: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  fileSize: number
  uploadedBy: string
  uploadedByName: string | null
  uploadedAt: string
  /** URL yang di-serve oleh API (lihat endpoint download). */
  url: string
}

/** Bentuk response API generic (sesuai pola existing products/defects). */
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}
