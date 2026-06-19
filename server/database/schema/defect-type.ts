import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

/**
 * Tabel: defect_types
 *
 * Master data jenis defect. Menggunakan soft delete via `is_active`.
 * Tidak bisa dihapus permanen jika sudah dipakai di claim
 * (FK di tabel `claims` menggunakan ON DELETE RESTRICT).
 */
export const defectTypes = sqliteTable('defect_types', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  category: text(), // Kategori defect bersifat opsional sesuai dokumen backend.md.
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
  uniqueIndex('defect_types_code_unique').on(table.code),
  uniqueIndex('defect_types_name_unique').on(table.name),
  index('defect_types_is_active_idx').on(table.isActive),
  index('defect_types_created_at_idx').on(table.createdAt)
]
)

export type DefectType = typeof defectTypes.$inferSelect
export type NewDefectType = typeof defectTypes.$inferInsert
