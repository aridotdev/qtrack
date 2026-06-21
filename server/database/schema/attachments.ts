import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { user } from './auth'

/**
 * Tabel: attachments
 *
 * Polymorphic attachment: sebuah file bisa milik entity mana pun
 * (`entity_type` + `entity_id`). Dipakai oleh:
 *
 * 1. **Issue Photos** saat create/edit claim
 *    `entity_type = 'claim'` & `entity_id = claim.id`
 *    (lihat task-plan §2.4 & §2.4.1).
 * 2. **Inline images** di dalam Rich Text Editor jurnal progres
 *    `entity_type = 'claim_progress'` & `entity_id = claim_progress_logs.id`
 *    (lihat task-plan §2.4 & Task 3.1).
 *
 * - `filePath` = path relatif terhadap folder `public/` (mis.
 *   `uploads/claim/123/abc.jpg`). URL publik dibangun oleh serializer
 *   sebagai `/<filePath>`.
 * - Hanya mime type tertentu yang boleh diunggah (divalidasi di service
 *   `storage.ts`): image/jpeg, image/png, image/webp.
 * - Batas jumlah foto per entity_type='claim' (5) diterapkan di service
 *   layer, bukan di schema (per spec §2.4.1 — soft limit, dapat
 *   berubah lewat konfigurasi).
 * - FK ke `user` (RESTRICT) untuk audit trail sesuai pattern existing.
 * - `entity_type` dipaksa ke salah satu nilai yang dikenal lewat CHECK
 *   constraint. Penambahan entity_type baru memerlukan migration.
 *
 * Catatan CASCADE:
 * - Saat claim dihapus, attachments dengan `entity_type='claim'`
 *   ikut terhapus via aplikasi (lihat service cleanup) — bukan FK
 *   CASCADE langsung, agar file fisik juga dapat di-unlink dalam
 *   satu transaction.
 * - Untuk `entity_type='claim_progress'`, FK CASCADE dideklarasikan
 *   eksplisit karena `claimProgressLogs` sendiri sudah CASCADE ke
 *   `claims`, sehingga chain cleanup terjadi di level DB.
 */
export const ATTACHMENT_ENTITY_TYPES = ['claim', 'claim_progress'] as const
export type AttachmentEntityType = typeof ATTACHMENT_ENTITY_TYPES[number]

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const
export type AllowedAttachmentMimeType = typeof ALLOWED_ATTACHMENT_MIME_TYPES[number]

export const attachments = sqliteTable('attachments', {
  id: integer().primaryKey({ autoIncrement: true }),

  // Polymorphic discriminator
  entityType: text().notNull().$type<AttachmentEntityType>(),
  entityId: integer().notNull(),

  // File metadata
  fileName: text().notNull(),
  filePath: text().notNull(), // path relatif terhadap `public/`
  mimeType: text().notNull().$type<AllowedAttachmentMimeType>(),
  fileSize: integer().notNull(), // bytes

  // Audit
  uploadedBy: text()
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),

  // Unix timestamp (ms)
  uploadedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
},
table => [
  // Index untuk query per entity (paling sering dipakai di UI Detail Claim)
  index('attachments_entity_idx').on(table.entityType, table.entityId),
  index('attachments_entity_uploaded_idx').on(table.entityType, table.entityId, table.uploadedAt),
  // Index untuk "foto saya" / audit
  index('attachments_uploaded_by_idx').on(table.uploadedBy)
  // CHECK constraint untuk entity_type dideklarasikan di migration
  // (lihat 0005_*.sql). Di schema ORM cukup $type<> di kolom di atas.
]
)

/**
 * Helper type untuk serialized attachment (dikirim ke klien).
 * Field URL dihitung di service serializer.
 */
export type Attachment = typeof attachments.$inferSelect
export type NewAttachment = typeof attachments.$inferInsert
