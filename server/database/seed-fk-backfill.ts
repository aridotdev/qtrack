/**
 * Backfill `createdBy` / `updatedBy` di tabel master dari placeholder
 * non-user (`'system'`) ke ID user admin yang valid.
 *
 * Konteks: sebelum Better Auth di-integrasikan, kolom audit diisi
 * literal `'system'`. Setelah FK ke tabel `user` dipasang, nilai
 * tersebut tidak valid lagi dan akan menyebabkan FK violation.
 *
 * Skrip ini:
 *   1. Mengambil ID user admin pertama (dibuat oleh seed-admin).
 *   2. Meng-update semua row di products / product_models /
 *      defect_categories / defects yang masih punya createdBy='system'
 *      atau updatedBy='system' menjadi ID admin tsb.
 *   3. Idempotent — aman dijalankan berulang.
 *
 * Jalankan SETELAH `pnpm db:seed:admin` dan SEBELUM `pnpm db:migrate`
 * untuk migrasi yang menambah FK ke `user.id`.
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { user } from './schema'

const TABLES = ['products', 'product_models', 'defect_categories', 'defects'] as const
const PLACEHOLDER = 'system'

async function main() {
  // 1. Cari user admin pertama (paling lama dibuat).
  const admins = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.role, 'admin'))
    .orderBy(user.createdAt)
    .limit(1)

  if (admins.length === 0) {
    throw new Error(
      'Tidak ada user admin. Jalankan `pnpm db:seed:admin` terlebih dahulu.'
    )
  }

  const adminId = admins[0]!.id
  console.log(`\nBackfill placeholder → admin (${admins[0]!.email}, id=${adminId})\n`)

  // 2. Update per-tabel dengan raw SQL agar jelas affected rows.
  const client = createClient({
    url: process.env.DATABASE_URL || 'file:./data/local.db'
  })

  let totalUpdated = 0
  for (const table of TABLES) {
    for (const col of ['createdBy', 'updatedBy'] as const) {
      const res = await client.execute({
        sql: `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`,
        args: [adminId, PLACEHOLDER]
      })
      const rows = Number(res.rowsAffected ?? 0)
      if (rows > 0) {
        console.log(`  ✓ ${table}.${col}: ${rows} row(s) updated`)
        totalUpdated += rows
      }
    }
  }

  if (totalUpdated === 0) {
    console.log('  (tidak ada row placeholder yang perlu di-backfill)')
  }

  console.log(`\n✓ Backfill selesai. Total ${totalUpdated} cell diperbarui.\n`)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('\n✗ Backfill gagal:')
  console.error(e instanceof Error ? e.stack || e.message : e)
  process.exit(1)
})
