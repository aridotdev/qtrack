import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { db } from '../database' // drizzle instance
import * as schema from '../database/schema'
import { z } from 'zod'

// ============================================================================
// Role & Permission
// ============================================================================

/** Single source of truth untuk role aplikasi (PRD §1.3 + RBAC). */
export const RoleSchema = z.enum(['admin', 'qrcc', 'pqa', 'management'])
export type AppRole = z.infer<typeof RoleSchema>

/**
 * Definisi access control dengan statement (action × resource).
 * Format Better Auth access-control: `{ [resource]: { [action]: boolean } }`.
 *
 * Untuk MVP fokus pada kemampuan inti per role; permission yang lebih
 * granular (mis. per resource claim/sample) bisa ditambahkan kemudian
 * tanpa breaking — cukup tambah key baru di sini.
 */
const statement = {
  // Aksi global aplikasi
  app: ['manage', 'view'],
  // Master data (produk, model, defect category, defect, user)
  master: ['manage', 'view'],
  // Claims Log
  claim: ['create', 'read', 'update', 'delete', 'export'],
  // Sample Log
  sample: ['create', 'read', 'update', 'delete'],
  // PQA Summary
  pqa: ['create', 'read', 'update', 'delete'],
  // Laporan bulanan
  report: ['create', 'read', 'update', 'delete', 'export']
} as const

export const ac = createAccessControl(statement)

/** Role map: setiap role mewarisi permission sesuai statement di atas. */
export const roles = {
  admin: ac.newRole({
    app: ['manage'],
    master: ['manage'],
    claim: ['create', 'read', 'update', 'delete', 'export'],
    sample: ['create', 'read', 'update', 'delete'],
    pqa: ['create', 'read', 'update', 'delete'],
    report: ['create', 'read', 'update', 'delete', 'export']
  }),
  qrcc: ac.newRole({
    app: ['view'],
    master: ['view'],
    claim: ['create', 'read', 'update', 'export'],
    sample: ['create', 'read', 'update'],
    pqa: ['read'],
    report: ['create', 'read', 'update', 'export']
  }),
  pqa: ac.newRole({
    app: ['view'],
    master: ['view'],
    claim: ['read'],
    sample: ['read', 'update'],
    pqa: ['create', 'read', 'update'],
    report: ['read']
  }),
  management: ac.newRole({
    app: ['view'],
    master: ['view'],
    claim: ['read', 'export'],
    sample: ['read'],
    pqa: ['read'],
    report: ['read', 'export']
  })
}

// ============================================================================
// Better Auth instance
// ============================================================================

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      // Peta schema Drizzle → tabel Better Auth.
      // Field tambahan (role) dideklarasikan via `additionalFields` di bawah.
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),

  // Email + password — cukup untuk MVP internal (PRD §3.8 / FR-35).
  emailAndPassword: {
    enabled: true,
    // Tidak perlu verifikasi email untuk user internal; aktifkan bila
    // sewaktu-waktu dibutuhkan (lihat FR-38 & §4 Keamanan).
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },

  // Session config (PRD §4: session expire 8 jam).
  session: {
    expiresIn: 60 * 60 * 8, // 8 jam (detik)
    updateAge: 60 * 60, // refresh tiap 1 jam
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 menit cache di cookie
    }
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'qrcc',
        input: false // tidak boleh di-set sembarangan dari client saat sign-up
      }
    }
  },

  // Admin plugin: handle CRUD user, ban, impersonate, set role.
  // Permission granular di-delegasikan ke access-control di atas.
  plugins: [
    admin({
      ac,
      roles,
      // Role tertinggi (dipakai admin plugin untuk guard /admin endpoints).
      adminRoles: ['admin'],
      // User pertama yang dibuat via `auth.api.signUpEmail` otomatis
      // dipromosikan jadi admin jika ini user pertama di sistem
      // (berguna untuk bootstrap; kita TETAP pakai script seed manual
      // agar deterministic dan bisa diaudit).
      defaultRole: 'qrcc'
    })
  ],

  // Secret untuk signing cookie/JWT. WAJIB diset di .env (lihat .env.example).
  secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-please-change-in-production',

  // Base URL untuk callback/link auth.
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',

  // Trusted origins (frontend lain yang boleh panggil API auth).
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000'
  ]
})

// Export type session untuk penggunaan downstream (e.g. di composables).
export type AuthSession = typeof auth.$Infer.Session
