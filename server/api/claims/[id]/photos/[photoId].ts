import { eq, and } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  setResponseStatus
} from 'h3'
import { z } from 'zod'
import { db } from '../../../../database'
import {
  claims,
  attachments
} from '../../../../database/schema'
import { assertCanManageOwnedClaim, requireAccess } from '../../../../utils/rbac'
import { deleteFile } from '../../../../services/storage'

/**
 * API: DELETE /api/claims/:id/photos/:photoId
 *
 * Hapus satu Issue Photo. File fisik di-unlink best-effort.
 * Hak akses: claim:update (admin, qrcc). Task 3.2 akan menambahkan
 * validasi "hanya creator/admin".
 */

const paramSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  if (event.method !== 'DELETE') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const idRaw = getRouterParam(event, 'id')
  const photoIdRaw = getRouterParam(event, 'photoId')
  const params = paramSchema.safeParse({ id: idRaw, photoId: photoIdRaw })
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id', message: 'ID tidak valid' })
  }
  const { id: claimId, photoId } = params.data

  const user = await requireAccess(event, 'claim', 'update')

  const [claim] = await db.select({ id: claims.id, createdBy: claims.createdBy }).from(claims).where(eq(claims.id, claimId)).limit(1)
  if (!claim) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
  }
  assertCanManageOwnedClaim(user, claim.createdBy)

  const [photo] = await db
    .select()
    .from(attachments)
    .where(and(
      eq(attachments.id, photoId),
      eq(attachments.entityType, 'claim'),
      eq(attachments.entityId, claimId)
    ))
    .limit(1)

  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Foto tidak ditemukan' })
  }

  // Hapus row dulu agar DB konsisten walau file gagal di-unlink.
  await db.delete(attachments).where(eq(attachments.id, photoId))
  await deleteFile(photo.filePath)

  setResponseStatus(event, 204)
  return null
})
