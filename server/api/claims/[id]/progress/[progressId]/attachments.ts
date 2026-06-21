import { and, eq } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  readMultipartFormData,
  setResponseStatus
} from 'h3'
import { z } from 'zod'
import { db } from '../../../../../database'
import {
  attachments,
  claims,
  claimProgressLogs,
  user as userSchema
} from '../../../../../database/schema'
import { serializeIssuePhoto } from '../../../../../services/claim-serializer'
import {
  isAllowedMimeType,
  MAX_FILE_SIZE,
  saveFile,
  deleteFile,
  StorageError
} from '../../../../../services/storage'
import { assertCanManageOwnedClaim, requireAccess } from '../../../../../utils/rbac'

/**
 * API: POST /api/claims/:id/progress/:progressId/attachments
 *
 * Upload inline image dari Rich Text Editor untuk satu progress log.
 * File dicatat sebagai attachment polymorphic:
 *   entity_type = 'claim_progress'
 *   entity_id   = claim_progress_logs.id
 */

const paramSchema = z.object({
  id: z.coerce.number().int().positive(),
  progressId: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const params = paramSchema.safeParse({
    id: getRouterParam(event, 'id'),
    progressId: getRouterParam(event, 'progressId')
  })
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id', message: 'ID tidak valid' })
  }
  const { id: claimId, progressId } = params.data

  const user = await requireAccess(event, 'claim', 'update')

  const [claim] = await db
    .select({ id: claims.id, createdBy: claims.createdBy })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1)
  if (!claim) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
  }
  assertCanManageOwnedClaim(user, claim.createdBy)

  const [progress] = await db
    .select({ id: claimProgressLogs.id, claimId: claimProgressLogs.claimId })
    .from(claimProgressLogs)
    .where(and(eq(claimProgressLogs.id, progressId), eq(claimProgressLogs.claimId, claimId)))
    .limit(1)
  if (!progress) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Jurnal progres tidak ditemukan' })
  }

  const contentType = (event.node.req.headers['content-type'] ?? '').toString()
  if (!contentType.includes('multipart/form-data')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid content type',
      message: 'Upload gambar harus menggunakan multipart/form-data'
    })
  }

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(part =>
    (part.name === 'image' || part.name === 'file')
    && part.filename
    && part.data
  )
  if (!filePart?.filename || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file',
      message: 'Tidak ada gambar yang diunggah. Gunakan field "image".'
    })
  }

  const file = {
    name: filePart.filename,
    type: filePart.type ?? 'application/octet-stream',
    size: filePart.data.length,
    data: filePart.data
  }

  if (!isAllowedMimeType(file.type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported media type',
      message: `Format ${file.name} tidak didukung. Gunakan JPEG, PNG, atau WebP.`
    })
  }

  if (file.size > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File too large',
      message: `Ukuran ${file.name} melebihi batas ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`
    })
  }

  let saved: Awaited<ReturnType<typeof saveFile>> | null = null
  try {
    saved = await saveFile(file, 'claim_progress', progressId)

    const [inserted] = await db.insert(attachments).values({
      entityType: 'claim_progress',
      entityId: progressId,
      fileName: saved.fileName,
      filePath: saved.relativePath,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      uploadedBy: user.id
    }).returning()

    if (!inserted) {
      throw new Error('Attachment insert failed')
    }

    const [row] = await db
      .select({
        id: attachments.id,
        entityType: attachments.entityType,
        entityId: attachments.entityId,
        fileName: attachments.fileName,
        filePath: attachments.filePath,
        mimeType: attachments.mimeType,
        fileSize: attachments.fileSize,
        uploadedBy: attachments.uploadedBy,
        uploadedByName: userSchema.name,
        uploadedAt: attachments.uploadedAt
      })
      .from(attachments)
      .leftJoin(userSchema, eq(attachments.uploadedBy, userSchema.id))
      .where(eq(attachments.id, inserted.id))
      .limit(1)

    if (!row) {
      throw new Error('Attachment read failed')
    }

    setResponseStatus(event, 201)
    return {
      success: true,
      data: serializeIssuePhoto({
        ...row,
        uploadedByName: row.uploadedByName ?? null
      })
    }
  } catch (error) {
    if (saved) {
      await deleteFile(saved.relativePath)
    }
    if (error instanceof StorageError) {
      throw createError({ statusCode: 400, statusMessage: 'Upload failed', message: error.message })
    }
    console.error('[progress.attachments.POST] failed:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Upload failed',
      message: 'Gagal mengunggah gambar progress'
    })
  }
})
