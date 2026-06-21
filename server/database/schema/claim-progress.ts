import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { claims } from './claim'
import { user } from './auth'

/**
 * Tabel: claim_progress_logs
 *
 * [NEW] Jurnal progres harian klaim. Disusun kronologis berdasarkan
 * `progressDate` di halaman Detail Claim.
 *
 * - `notes` berisi HTML string hasil WYSIWYG editor (spt TipTap/Quill).
 *   HTML harus di-sanitize sebelum dirender di UI (lihat Task 3.x di frontend).
 * - `progressDate` bisa berbeda dari `createdAt` — user dapat backdate
 *   progres ke tanggal kegiatan yang sebenarnya.
 * - Sorting di UI berdasarkan `progressDate` ASC (kronologis).
 * - Gambar yang disisipkan di dalam notes direferensikan via tabel
 *   `attachments` (`entityType = 'claim_progress'`, `entityId = id log ini`).
 * - Jika claim dihapus, semua progress log ikut terhapus (CASCADE).
 *
 * Hak akses: QRCC & Admin (full CRUD), PQA (create & read).
 */
export const claimProgressLogs = sqliteTable('claim_progress_logs', {
  id: integer().primaryKey({ autoIncrement: true }),
  claimId: integer()
    .notNull()
    .references(() => claims.id, { onDelete: 'cascade' }),
  // Tanggal aktual kegiatan (Unix timestamp ms), bisa backdate.
  progressDate: integer({ mode: 'timestamp_ms' }).notNull(),
  // Output HTML dari Rich Text Editor (bold, tabel, gambar).
  notes: text().notNull(),
  createdBy: text()
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
  index('claim_progress_logs_claim_id_idx').on(table.claimId),
  index('claim_progress_logs_progress_date_idx').on(table.progressDate),
  index('claim_progress_logs_claim_id_progress_date_idx').on(table.claimId, table.progressDate),
  index('claim_progress_logs_created_by_idx').on(table.createdBy)
]
)

export type ClaimProgressLog = typeof claimProgressLogs.$inferSelect
export type NewClaimProgressLog = typeof claimProgressLogs.$inferInsert
