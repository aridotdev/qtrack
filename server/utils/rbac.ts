// server/utils/rbac.ts
import type { H3Event } from 'h3'
import type { AppRole } from './auth'
import { auth } from './auth'

/**
 * Memastikan user login dan memiliki salah satu role yang diizinkan.
 */
export const requireRole = async (event: H3Event, allowedRoles: AppRole[]) => {
  // Ambil session dari header request
  const session = await auth.api.getSession({
    headers: event.headers
  })

  if (!session || !session.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Silakan login terlebih dahulu'
    })
  }

  const userRole = session.user.role as AppRole

  if (!allowedRoles.includes(userRole)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: Akses ditolak untuk role ${userRole}`
    })
  }

  // Kembalikan objek user agar bisa digunakan oleh endpoint terkait
  return session.user
}
