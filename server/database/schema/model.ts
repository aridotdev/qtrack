import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { products } from './product'

/**
 * Tabel: product_models
 *
 * Model/versi turunan dari sebuah produk.
 * - Tidak bisa hapus produk induk jika masih ada model aktif (RESTRICT).
 * - Dropdown model di form claim difilter berdasarkan produk yang dipilih.
 *
 * Catatan penamaan: tabel di DB bernama `product_models`, namun variabel
 * export-nya kita singkat menjadi `productModels` agar ergonomis.
 */
export const productModels = sqliteTable('product_models', {
  id: integer().primaryKey({ autoIncrement: true }),
  sku: text().notNull(),
  name: text().notNull(),
  productId: integer()
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
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
  uniqueIndex('product_models_sku_unique').on(table.sku),
  // Nama model harus unik dalam scope produk yang sama.
  uniqueIndex('product_models_name_product_unique').on(table.name, table.productId),
  index('product_models_product_id_idx').on(table.productId),
  index('product_models_is_active_idx').on(table.isActive),
  index('product_models_product_id_is_active_idx').on(table.productId, table.isActive)
]
)

export type ProductModel = typeof productModels.$inferSelect
export type NewProductModel = typeof productModels.$inferInsert
