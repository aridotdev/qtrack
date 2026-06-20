import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { user } from './auth'

/**
 * Tabel: products
 *
 * Master data produk. Menggunakan soft delete via `isActive`.
 * Tidak bisa dihapus permanen jika sudah dipakai di claim
 * (referential integrity dijaga via FK dengan ON DELETE RESTRICT
 * di tabel `claims`).
 *
 * Audit trail (`createdBy`, `updatedBy`) terhubung ke `user.id`
 * dari Better Auth dengan ON DELETE RESTRICT — kita tidak boleh
 * kehilangan jejak "siapa yang buat/ubah record ini" walau user
 * dihapus/di-ban (lihat PRD §4 Keamanan & §3.8 Manajemen Pengguna).
 */
export const products = sqliteTable('products', {
  id: integer().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
  name: text().notNull(),
  isActive: integer({ mode: 'boolean' }).notNull().default(true),

  // Audit: FK ke Better Auth `user`. RESTRICT agar history tetap utuh
  // walau user di-ban/dihapus (FK error lebih baik daripada audit hilang).
  createdBy: text()
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),
  updatedBy: text()
    .notNull()
    .references(() => user.id, { onDelete: 'restrict' }),

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
  index('products_created_at_idx').on(table.createdAt),
  index('products_created_by_idx').on(table.createdBy),
  index('products_updated_by_idx').on(table.updatedBy)
]
)

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
