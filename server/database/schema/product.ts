import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

/**
 * Tabel: products
 *
 * Master data produk. Menggunakan soft delete via `is_active`.
 * Tidak bisa dihapus permanen jika sudah dipakai di claim
 * (referential integrity dijaga via FK dengan ON DELETE RESTRICT
 * di tabel `claims`).
 */
export const products = sqliteTable('products', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  // Boolean (1 = aktif, 0 = non-aktif). Disimpan sebagai integer
  // karena SQLite tidak punya tipe boolean native.
  isActive: integer({ mode: 'boolean' }).notNull().default(true),

  // Sementara belum memakai FK ke users karena Better Auth schema
  // akan diintegrasikan pada fase berikutnya.
  createdBy: text().notNull(),
  updatedBy: text().notNull(),

  // Unix timestamp (ms) — konsisten dengan seluruh tabel di project ini.
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
},
table => [
  uniqueIndex('products_code_unique').on(table.code),
  index('products_is_active_idx').on(table.isActive),
  index('products_created_at_idx').on(table.createdAt)
]
)

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
