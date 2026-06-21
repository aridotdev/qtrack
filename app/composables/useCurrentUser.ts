import { createAuthClient } from 'better-auth/vue'
import type { AppRole } from '#shared/roles'

/**
 * Tipe user sesi yang kita pakai di client.
 *
 * Better Auth di-infer dari `additionalFields` di server; client
 * `createAuthClient()` tidak otomatis membawa field tambahan, jadi
 * kita deklarasikan `role` (lihat `shared/roles.ts → RoleSchema`)
 * secara eksplisit di sini.
 */
export type SessionUser = {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  role: AppRole
}

/**
 * Composable kecil untuk mengambil user sesi saat ini dengan tipe
 * yang sudah mencakup `role`.
 *
 * Dipakai oleh halaman/feature yang butuh RBAC (mis. gating tombol
 * "Claim Baru" untuk role `admin` / `qrcc`).
 */
export function useCurrentUser() {
  const authClient = createAuthClient()
  const session = authClient.useSession()

  const user = computed<SessionUser | null>(() => {
    const u = session.value?.data?.user
    return (u as SessionUser | null | undefined) ?? null
  })

  return { session, user }
}
