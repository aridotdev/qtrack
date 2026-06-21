import type { claims, claimStatusLogs, claimProgressLogs, attachments, products, productModels, defects, user as userSchema } from '../database/schema'

/**
 * Serializer untuk response API Claims.
 *
 * Kontrak output untuk klien (lihat `app/types/claim.ts`):
 *  - timestamps → ISO string
 *  - relasi (product/model/defect/user) → nama+code fields null-safe
 *  - Issue Photos URL di-prefix dengan `/` agar langsung bisa dipakai
 *    di `<img src>` oleh klien.
 *
 * Pola: `serializeClaim` menerima row hasil join manual (lihat
 * endpoint yang memanggil). `serializeProgressLog` dan
 * `serializeIssuePhoto` mengikuti pola yang sama.
 */

// ---------------------------------------------------------------------------
// Bentuk row mentah hasil JOIN (dipakai oleh endpoint sebagai type-safe cast)
// ---------------------------------------------------------------------------

export interface ClaimJoinRow {
  // claim columns — required (wajib ada dari SELECT claim)
  id: number
  claimCode: string
  productId: number
  modelId: number
  defectId: number
  source: string
  description: string
  status: string
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
  // joined — optional karena Drizzle leftJoin menandai field sebagai
  // `T | undefined` saat leftJoin. Serializer fallback ke null/default.
  productName?: string | null
  productCode?: string | null
  modelName?: string | null
  modelSku?: string | null
  defectName?: string | null
  defectCode?: string | null
  createdByName?: string | null
  updatedByName?: string | null
  photoCount?: number | null
  progressLogCount?: number | null
}

export interface ProgressLogJoinRow {
  id: number
  claimId: number
  progressDate: Date
  notes: string
  createdBy: string
  createdByName?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IssuePhotoJoinRow {
  id: number
  entityType: string
  entityId: number
  fileName: string
  filePath: string
  mimeType: string
  fileSize: number
  uploadedBy: string
  uploadedByName?: string | null
  uploadedAt: Date
}

// ---------------------------------------------------------------------------
// Valid status enum (mirror schema)
// ---------------------------------------------------------------------------

export const CLAIM_STATUSES = ['OPEN', 'WAITING_PQA', 'ON_PROGRESS', 'CLOSED'] as const
export type ClaimStatus = typeof CLAIM_STATUSES[number]

export function isValidClaimStatus(value: string): value is ClaimStatus {
  return (CLAIM_STATUSES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// State machine — alur transisi status yang diizinkan
// ---------------------------------------------------------------------------

/**
 * Peta transisi status. Key = status asal, Value = daftar status tujuan.
 * - OPEN → WAITING_PQA (QRCC menyerah ke PQA untuk review)
 * - WAITING_PQA → ON_PROGRESS (PQA mulai investigasi/perbaikan)
 * - ON_PROGRESS → CLOSED (selesai)
 * - CLOSED → (terminal, tidak bisa pindah)
 */
const STATUS_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  OPEN: ['WAITING_PQA'],
  WAITING_PQA: ['ON_PROGRESS'],
  ON_PROGRESS: ['CLOSED'],
  CLOSED: []
}

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export function allowedNextStatuses(from: ClaimStatus): readonly ClaimStatus[] {
  return STATUS_TRANSITIONS[from] ?? []
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

/**
 * Serialize satu claim ke shape yang dipakai klien. Field tambahan
 * (photoCount, progressLogCount) opsional; jika tidak diberikan
 * (mis. pada list endpoint yang tidak menghitung), default ke 0.
 *
 * Catatan: parameter `row` bisa berisi field `undefined` ketika hasil
 * Drizzle leftJoin tidak menemukan baris relasi. Serializer menormalkan
 * ke `null` (untuk string) atau `0` (untuk counts) sesuai kontrak klien.
 */
export function serializeClaim(
  row: ClaimJoinRow,
  counts?: { photoCount?: number, progressLogCount?: number }
) {
  return {
    id: row.id,
    claimCode: row.claimCode,
    productId: row.productId,
    productName: row.productName ?? null,
    productCode: row.productCode ?? null,
    modelId: row.modelId,
    modelName: row.modelName ?? null,
    modelSku: row.modelSku ?? null,
    defectId: row.defectId,
    defectName: row.defectName ?? null,
    defectCode: row.defectCode ?? null,
    source: row.source,
    description: row.description,
    status: row.status,
    createdBy: row.createdBy,
    createdByName: row.createdByName ?? null,
    updatedBy: row.updatedBy,
    updatedByName: row.updatedByName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    photoCount: counts?.photoCount ?? row.photoCount ?? 0,
    progressLogCount: counts?.progressLogCount ?? row.progressLogCount ?? 0
  }
}

export function serializeProgressLog(row: ProgressLogJoinRow) {
  return {
    id: row.id,
    claimId: row.claimId,
    progressDate: row.progressDate.toISOString(),
    notes: row.notes,
    createdBy: row.createdBy,
    createdByName: row.createdByName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export function serializeIssuePhoto(row: IssuePhotoJoinRow) {
  // `filePath` sudah relatif terhadap `public/`. URL publik = `/<filePath>`.
  const url = row.filePath.startsWith('/')
    ? row.filePath
    : `/${row.filePath}`

  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    fileName: row.fileName,
    filePath: row.filePath,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    uploadedBy: row.uploadedBy,
    uploadedByName: row.uploadedByName ?? null,
    uploadedAt: row.uploadedAt.toISOString(),
    url
  }
}

// ---------------------------------------------------------------------------
// Type guards untuk validasi runtime minimal (sebelum serializer dipanggil)
// ---------------------------------------------------------------------------

export function isClaimRow(value: unknown): value is ClaimJoinRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'number'
    && typeof v.claimCode === 'string'
    && typeof v.productId === 'number'
}
