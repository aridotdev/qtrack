import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { user } from './auth'

/**
 * Tabel: defect_categories
 *
 * Master kategori defect (grouping broad, mis. Electrical, Mechanical, dll).
 * - Menggunakan soft delete via `isActive`.
 * - Tidak bisa dihapus permanen jika masih ada defect aktif di bawahnya
 *   (FK di tabel `defects` menggunakan ON DELETE RESTRICT).
 * - Dimulai kosong — QRCC yang mengelola sesuai taksonomi internal.
 *
 * Audit trail (`createdBy`, `updatedBy`) → FK ke Better Auth `user.id`
 * dengan ON DELETE RESTRICT (lihat product.ts untuk rationale).
 */
export const defectCategories = sqliteTable('defect_categories', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  description: text(),
  isActive: integer({ mode: 'boolean' }).notNull().default(true),

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
  uniqueIndex('defect_categories_code_unique').on(table.code),
  uniqueIndex('defect_categories_name_unique').on(table.name),
  index('defect_categories_is_active_idx').on(table.isActive),
  index('defect_categories_created_at_idx').on(table.createdAt),
  index('defect_categories_created_by_idx').on(table.createdBy),
  index('defect_categories_updated_by_idx').on(table.updatedBy)
]
)

export type DefectCategory = typeof defectCategories.$inferSelect
export type NewDefectCategory = typeof defectCategories.$inferInsert
