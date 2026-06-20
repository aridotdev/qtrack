import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { products } from './product'
import { user } from './auth'

/**
 * Tabel: product_models
 *
 * Model/versi turunan dari sebuah produk.
 * - Tidak bisa hapus produk induk jika masih ada model aktif (RESTRICT).
 * - Dropdown model di form claim difilter berdasarkan produk yang dipilih.
 *
 * Catatan penamaan: tabel di DB bernama `product_models`, namun variabel
 * export-nya kita singkat menjadi `productModels` agar ergonomis.
 *
 * Audit trail (`createdBy`, `updatedBy`) → FK ke Better Auth `user.id`
 * dengan ON DELETE RESTRICT (lihat product.ts untuk rationale).
 */
export const productModels = sqliteTable('product_models', {
  id: integer().primaryKey({ autoIncrement: true }),
  sku: text().notNull(),
  name: text().notNull(),
  productId: integer()
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
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
  uniqueIndex('product_models_sku_unique').on(table.sku),
  uniqueIndex('product_models_name_product_unique').on(table.name, table.productId),
  index('product_models_product_id_idx').on(table.productId),
  index('product_models_is_active_idx').on(table.isActive),
  index('product_models_product_id_is_active_idx').on(table.productId, table.isActive),
  index('product_models_created_by_idx').on(table.createdBy),
  index('product_models_updated_by_idx').on(table.updatedBy)
]
)

export type ProductModel = typeof productModels.$inferSelect
export type NewProductModel = typeof productModels.$inferInsert
