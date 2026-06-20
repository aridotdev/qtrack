import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'

/**
 * Skema Better Auth — SQLite/Drizzle.
 *
 * Tabel-tabel ini WAJIB mengikuti konvensi penamaan & kolom yang
 * dipakai oleh Better Auth (lihat https://www.better-auth.com/docs/concepts/database).
 * Field tambahan (seperti `role`) ditambahkan lewat `additionalFields`
 * di konfigurasi `auth.ts`.
 *
 * Catatan:
 * - Tidak ada FK ke tabel lain dari sini; seluruh relasi keluar
 *   (mis. `claims.createdBy`) cukup berupa `text` karena session/user
 *   adalah domain Better Auth, bukan domain bisnis kita.
 */

// ============================================================================
// user
// ============================================================================
export const user = sqliteTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: 'boolean' }).notNull().default(false),
  image: text(),
  // Field tambahan: role aplikasi (admin | qrcc | pqa | management)
  role: text().notNull().default('qrcc'),
  // Ban flag untuk admin plugin (jika diaktifkan di masa depan)
  banned: integer({ mode: 'boolean' }),
  banReason: text(),
  banExpires: integer({ mode: 'timestamp_ms' }),

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, table => [
  index('user_email_idx').on(table.email),
  index('user_role_idx').on(table.role)
])

// ============================================================================
// session
// ============================================================================
export const session = sqliteTable('session', {
  id: text().primaryKey(),
  expiresAt: integer({ mode: 'timestamp_ms' }).notNull(),
  token: text().notNull().unique(),
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date()),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Field tambahan (admin plugin): session ini milik user yang di-ban?
  impersonatedBy: text()
}, table => [
  index('session_user_id_idx').on(table.userId),
  index('session_expires_at_idx').on(table.expiresAt)
])

// ============================================================================
// account — kredensial (password hash, OAuth, dll) yang terhubung ke user
// ============================================================================
export const account = sqliteTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: integer({ mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer({ mode: 'timestamp_ms' }),
  scope: text(),
  password: text(), // hash bcrypt/argon2 untuk email+password

  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, table => [
  index('account_user_id_idx').on(table.userId),
  index('account_provider_account_idx').on(table.providerId, table.accountId)
])

// ============================================================================
// verification — token untuk email verification / reset password
// ============================================================================
export const verification = sqliteTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer({ mode: 'timestamp_ms' }).notNull(),
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdateFn(() => new Date())
}, table => [
  index('verification_identifier_idx').on(table.identifier),
  index('verification_expires_at_idx').on(table.expiresAt)
])

export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
