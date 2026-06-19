import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { defectCategories } from './defect-category'

/**
 * Tabel: defects
 *
 * Master jenis defect spesifik, dikelompokkan di bawah sebuah kategori.
 * - Nama defect unik per kategori (`unique(name, categoryId)`) — nama
 *   yang sama boleh ada di kategori berbeda karena cause-nya bisa beda.
 * - Menggunakan soft delete via `isActive`.
 * - Tidak bisa dihapus permanen jika sudah dipakai di claim
 *   (FK di tabel `claims` menggunakan ON DELETE RESTRICT).
 * - Tidak bisa menghapus kategori jika masih ada defect aktif (RESTRICT).
 */
export const defects = sqliteTable('defects', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  description: text(),
  categoryId: integer()
    .notNull()
    .references(() => defectCategories.id, { onDelete: 'restrict' }),
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
  uniqueIndex('defects_code_unique').on(table.code),
  // Nama defect harus unik dalam scope kategori yang sama.
  uniqueIndex('defects_name_category_unique').on(table.name, table.categoryId),
  index('defects_category_id_idx').on(table.categoryId),
  index('defects_is_active_idx').on(table.isActive),
  index('defects_created_at_idx').on(table.createdAt),
  index('defects_category_id_is_active_idx').on(table.categoryId, table.isActive)
]
)

export type Defect = typeof defects.$inferSelect
export type NewDefect = typeof defects.$inferInsert
