// server/utils/rbac.ts
import type { H3Event } from 'h3'
import { createError } from 'h3'
import { auth, ac, roles, type AppRole } from './auth'

/**
 * Resource × Action yang dipakai aplikasi.
 * Dipakai oleh `requireAccess()` untuk guard endpoint API.
 */
export type AccessAction =
  | 'create' | 'read' | 'update' | 'delete' | 'export' | 'manage' | 'view'

export type AccessResource =
  | 'app' | 'master' | 'claim' | 'sample' | 'pqa' | 'report'

/**
 * Memastikan user sudah login.
 * Mengembalikan session.user (yang sudah berisi `role`).
 */
export const requireAuth = async (event: H3Event) => {
  const session = await auth.api.getSession({
    headers: event.headers
  })

  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Silakan login terlebih dahulu'
    })
  }

  return session.user
}

/**
 * Memastikan user sudah login DAN role-nya termasuk dalam `allowedRoles`.
 * Gunakan untuk guard berbasis role saja (tanpa permission statement).
 *
 * @example
 *   const user = await requireRole(event, ['admin'])
 */
export const requireRole = async (event: H3Event, allowedRoles: AppRole[]) => {
  const user = await requireAuth(event)
  const userRole = user.role as AppRole

  if (!allowedRoles.includes(userRole)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: Akses ditolak untuk role ${userRole}`
    })
  }

  return user
}

/**
 * Guard berbasis access-control statement (role × permission).
 * Lebih granular daripada `requireRole` karena setiap role punya
 * permission berbeda per resource/action (lihat `auth.ts`).
 *
 * @example
 *   // Hanya admin & qrcc yang boleh create claim
 *   const user = await requireAccess(event, 'claim', 'create')
 *
 * @example
 *   // Semua role boleh read, tapi hanya admin yang boleh delete
 *   const user = await requireAccess(event, 'claim', 'delete')
 */
export const requireAccess = async (
  event: H3Event,
  resource: AccessResource,
  action: AccessAction
) => {
  const user = await requireAuth(event)
  const userRole = user.role as AppRole

  // Resolve role → permissions. Fallback ke role 'qrcc' (default) jika
  // role user tidak dikenal (mis. role dari versi schema lama).
  const roleDef = roles[userRole] ?? roles.qrcc
  const allowed = (roleDef.statements?.[resource] ?? []) as readonly AccessAction[]

  if (!allowed.includes(action) && !allowed.includes('manage')) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: role ${userRole} tidak punya akses ${action} pada ${resource}`
    })
  }

  return user
}

/**
 * Helper untuk endpoint opsional (tidak throw, hanya return boolean).
 * Berguna untuk UI conditional rendering di server.
 */
export const hasAccess = (
  user: { role?: string | null } | null | undefined,
  resource: AccessResource,
  action: AccessAction
): boolean => {
  if (!user?.role) return false
  const roleDef = roles[user.role as AppRole] ?? roles.qrcc
  const allowed = (roleDef.statements?.[resource] ?? []) as readonly AccessAction[]
  return allowed.includes(action) || allowed.includes('manage')
}

// Re-export untuk memudahkan import dari handler:
//   import { auth, ac, roles, type AppRole } from '~~/server/utils/auth'
export { auth, ac, roles, type AppRole }
