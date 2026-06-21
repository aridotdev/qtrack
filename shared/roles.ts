import { z } from 'zod'

/**
 * Definisi role aplikasi — dipakai bersama oleh client dan server.
 *
 * - Server: dipakai untuk RBAC, validasi, dan assignment role user
 *   (lihat `server/utils/auth.ts`).
 * - Client: dipakai untuk typing sesi user dan gating UI berdasarkan
 *   role (mis. tombol "Claim Baru" hanya untuk `admin` / `qrcc`).
 *
 * Single source of truth sehingga perubahan role harus dilakukan di
 * satu tempat saja.
 */
export const RoleSchema = z.enum(['admin', 'qrcc', 'pqa', 'management'])
export type AppRole = z.infer<typeof RoleSchema>
