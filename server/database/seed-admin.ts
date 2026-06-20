/**
 * Seed akun admin pertama untuk aplikasi QC Tracker.
 *
 * Tujuan:
 * - Memastikan ada minimal 1 user admin di sistem saat pertama kali
 *   di-bootstrap (PRD §3.8 FR-34: Manajemen Pengguna).
 * - Role lain (qrcc/pqa/management) akan dibuat belakangan lewat UI
 *   admin atau endpoint yang dilindungi role admin.
 *
 * Cara pakai:
 *   pnpm seed:admin
 *
 * Atau dengan override env:
 *   ADMIN_EMAIL=admin@qtrack.local ADMIN_PASSWORD=StrongPass123! pnpm seed:admin
 *
 * Env yang dibaca (semua punya default agar script bisa dijalankan
 * tanpa setup):
 *   ADMIN_NAME      — nama tampilan  (default: "QC Tracker Admin")
 *   ADMIN_EMAIL     — email login    (default: "admin@qtrack.local")
 *   ADMIN_PASSWORD  — password awal  (default: "Admin@2026")
 *
 * Perilaku:
 * - Jika email sudah ada → update `name` (password TIDAK diubah agar
 *   tidak men-revoke sesi admin yang sedang login).
 * - Jika belum ada      → buat user baru + password + set role='admin'.
 *
 * Output:
 *   Akan print ringkasan ke stdout. Tidak print password ke log
 *   untuk alasan keamanan.
 */

import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { auth } from '../utils/auth'
import { user } from './schema'
import { RoleSchema } from '../utils/auth'

async function main() {
  const name = process.env.ADMIN_NAME?.trim() || 'QC Tracker Admin'
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin@qtrack.local'
  const password = process.env.ADMIN_PASSWORD || 'Admin@2026'

  // Validasi role (defensive — harus 'admin' sesuai desain seed ini).
  const role = 'admin'
  const parsed = RoleSchema.safeParse(role)
  if (!parsed.success) {
    throw new Error(`Role seed tidak valid: ${role}`)
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD minimal 8 karakter.')
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  QC Tracker — Seed Admin')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Name   : ${name}`)
  console.log(`  Email  : ${email}`)
  console.log(`  Role   : ${role}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Cek apakah user sudah ada.
  const existing = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (existing.length > 0) {
    // 2a. Update — JANGAN reset password (agar tidak revoke sesi aktif).
    await db
      .update(user)
      .set({ name, role, updatedAt: new Date() })
      .where(eq(user.id, existing[0]!.id))

    console.log(`✓ User admin sudah ada (id=${existing[0]!.id}).`)
    console.log('  • name & role diperbarui.')
    console.log('  • Password TIDAK diubah (gunakan UI ganti password bila perlu).\n')
    return
  }

  // 2b. Belum ada → signUp lewat Better Auth (hash password benar).
  // signUpEmail default role 'qrcc'; kita override setelahnya lewat
  // direct update karena `additionalFields.role.input = false` demi
  // keamanan (admin tidak bisa self-promote dari sign-up form).
  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password
        // role sengaja tidak dikirim — kita set manual setelahnya
      }
    })
  } catch (err) {
    // Jika Better Auth melempar error karena user sudah ada (race
    // condition) kita lanjutkan ke step update.
    const msg = err instanceof Error ? err.message : String(err)
    if (!/already|exists|unique/i.test(msg)) throw err
  }

  // 3. Promote ke admin.
  const updated = await db
    .update(user)
    .set({ role, updatedAt: new Date() })
    .where(eq(user.email, email))
    .returning({ id: user.id, role: user.role })

  if (updated.length === 0) {
    throw new Error(
      `Gagal membuat user admin untuk ${email}. ` +
      'Periksa log Better Auth di atas untuk detail.'
    )
  }

  console.log(`✓ Akun admin berhasil dibuat.`)
  console.log(`  ID    : ${updated[0]!.id}`)
  console.log(`  Role  : ${updated[0]!.role}`)
  console.log('\n  ⚠ Segera ganti password setelah login pertama.\n')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✗ Seed admin gagal:')
    console.error(err instanceof Error ? err.stack || err.message : err)
    process.exit(1)
  })
