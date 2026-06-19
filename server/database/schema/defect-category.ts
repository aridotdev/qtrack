import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

/**
 * Tabel: defect_categories
 *
 * Master kategori defect (grouping broad, mis. Electrical, Mechanical, dll).
 * - Menggunakan soft delete via `isActive`.
 * - Tidak bisa dihapus permanen jika masih ada defect aktif di bawahnya
 *   (FK di tabel `defects` menggunakan ON DELETE RESTRICT).
 * - Dimulai kosong — QRCC yang mengelola sesuai taksonomi internal.
 */
export const defectCategories = sqliteTable('defect_categories', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  description: text(),
  isActive: integer({ mode: 'boolean' }).notNull().default(true),
  // Sementara belum memakai FK ke users karena Better Auth schema
  // akan diintegrasikan pada fase berikutnya.
  createdBy: text().notNull(),
  updatedBy: text().notNull(),

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
  uniqueIndex('defect_categories_code_unique').on(table.code),
  uniqueIndex('defect_categories_name_unique').on(table.name),
  index('defect_categories_is_active_idx').on(table.isActive),
  index('defect_categories_created_at_idx').on(table.createdAt)
]
)

export type DefectCategory = typeof defectCategories.$inferSelect
export type NewDefectCategory = typeof defectCategories.$inferInsert
