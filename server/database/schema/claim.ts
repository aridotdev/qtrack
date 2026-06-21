import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { products } from './product'
import { productModels } from './model'
import { defects } from './defects'
import { user } from './auth'

/**
 * Tabel: claims
 *
 * Core module — Single Source of Truth untuk pencatatan klaim QC Market.
 *
 * - `claimCode` di-generate otomatis oleh service layer (format: CLM-YYYY-NNN),
 *   bukan input user.
 * - Status hanya boleh maju sesuai alur: OPEN → WAITING_PQA → ON_PROGRESS → CLOSED.
 *   Setiap transisi otomatis tercatat di tabel `claimStatusLogs` dalam satu
 *   database transaction (lihat Task 1.6).
 * - FK ke master data (products / productModels / defects) menggunakan
 *   ON DELETE RESTRICT agar master data tidak bisa dihapus permanen jika
 *   sudah dipakai di claim (sesuai catatan di PRD/backend.md).
 *
 * Audit trail (`createdBy`, `updatedBy`) → FK ke Better Auth `user.id`
 * dengan ON DELETE RESTRICT (lihat product.ts untuk rationale).
 */
export const claims = sqliteTable('claims', {
  id: integer().primaryKey({ autoIncrement: true }),
  claimCode: text().notNull(), // Format: CLM-YYYY-NNN (auto-generated)
  productId: integer()
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  modelId: integer()
    .notNull()
    .references(() => productModels.id, { onDelete: 'restrict' }),
  defectId: integer()
    .notNull()
    .references(() => defects.id, { onDelete: 'restrict' }),
  source: text().notNull(),
  description: text().notNull(),
  // OPEN → WAITING_PQA → ON_PROGRESS → CLOSED
  status: text().notNull().default('OPEN'),

  createdBy: text()
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  updatedBy: text()
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),

  // Unix timestamp (ms).
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
},
table => [
  uniqueIndex('claims_claim_code_unique').on(table.claimCode),
  index('claims_status_idx').on(table.status),
  index('claims_product_id_idx').on(table.productId),
  index('claims_model_id_idx').on(table.modelId),
  index('claims_defect_id_idx').on(table.defectId),
  index('claims_created_at_idx').on(table.createdAt),
  index('claims_product_id_status_idx').on(table.productId, table.status),
  index('claims_created_by_idx').on(table.createdBy),
  index('claims_updated_by_idx').on(table.updatedBy)
]
)

/**
 * Tabel: claim_status_logs
 *
 * State Machine log — riwayat transisi status klaim.
 * - Dibuat otomatis oleh service dalam satu database transaction
 *   saat update status (lihat Task 1.6), tidak pernah dibuat manual dari UI.
 * - Jika claim dihapus, semua log ikut terhapus (CASCADE).
 * - `oldStatus` bisa NULL (untuk status log pertama kali saat claim dibuat).
 */
export const claimStatusLogs = sqliteTable('claim_status_logs', {
  id: integer().primaryKey({ autoIncrement: true }),
  claimId: integer()
    .notNull()
    .references(() => claims.id, { onDelete: 'cascade' }),
  oldStatus: text(), // null jika baru (status awal OPEN)
  newStatus: text().notNull(),
  changedBy: text()
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  // Unix timestamp (ms).
  changedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
},
table => [
  index('claim_status_logs_claim_id_idx').on(table.claimId),
  index('claim_status_logs_changed_at_idx').on(table.changedAt),
  index('claim_status_logs_claim_id_changed_at_idx').on(table.claimId, table.changedAt)
]
)

export type Claim = typeof claims.$inferSelect
export type NewClaim = typeof claims.$inferInsert
export type ClaimStatusLog = typeof claimStatusLogs.$inferSelect
export type NewClaimStatusLog = typeof claimStatusLogs.$inferInsert

/**
 * Konstanta status claim (state machine).
 * Dipakai bersama oleh schema & service layer untuk validasi transisi.
 */
export const CLAIM_STATUSES = ['OPEN', 'WAITING_PQA', 'ON_PROGRESS', 'CLOSED'] as const
export type ClaimStatus = typeof CLAIM_STATUSES[number]
