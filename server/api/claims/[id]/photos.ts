import { eq, and, asc, sql } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  readMultipartFormData,
  setResponseStatus
} from 'h3'
import { z } from 'zod'
import { db } from '../../../database'
import {
  claims,
  attachments,
  user as userSchema
} from '../../../database/schema'
import { assertCanManageOwnedClaim, requireAccess } from '../../../utils/rbac'
import { serializeIssuePhoto } from '../../../services/claim-serializer'
import {
  saveFile,
  deleteFile,
  isAllowedMimeType,
  MAX_FILE_SIZE,
  StorageError
} from '../../../services/storage'
import { MAX_ISSUE_PHOTOS_PER_CLAIM } from '../index'

/**
 * API: /api/claims/:id/photos
 *
 *  - GET  : list Issue Photos untuk claim (entity_type='claim'),
 *           diurut ASC by uploadedAt (kronologis upload, sesuai spec §2.4.1).
 *  - POST : upload Issue Photos tambahan (max 5 total per claim).
 *           multipart/form-data dengan field `photos` (multiple files).
 *
 * Task 1.8 — API khusus untuk upload & delete Issue Photos.
 */

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const idParsed = idParamSchema.safeParse({ id: idRaw })
  if (!idParsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id', message: 'ID claim tidak valid' })
  }
  const claimId = idParsed.data.id

  if (event.method === 'GET') {
    await requireAccess(event, 'claim', 'read')

    const [claim] = await db.select({ id: claims.id }).from(claims).where(eq(claims.id, claimId)).limit(1)
    if (!claim) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }

    const rows = await db
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
      .where(and(
        eq(attachments.entityType, 'claim'),
        eq(attachments.entityId, claimId)
      ))
      .orderBy(asc(attachments.uploadedAt))

    return {
      success: true,
      data: rows.map((row) => serializeIssuePhoto({
        ...row,
        uploadedByName: row.uploadedByName ?? null
      }))
    }
  }

  if (event.method === 'POST') {
    const user = await requireAccess(event, 'claim', 'update')

    const [claim] = await db.select({ id: claims.id, createdBy: claims.createdBy }).from(claims).where(eq(claims.id, claimId)).limit(1)
    if (!claim) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }
    assertCanManageOwnedClaim(user, claim.createdBy)

    // Validasi content type & body
    const contentType = (event.node.req.headers['content-type'] ?? '').toString()
    if (!contentType.includes('multipart/form-data')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid content type',
        message: 'Upload foto harus menggunakan multipart/form-data'
      })
    }

    const parts = await readMultipartFormData(event)
    if (!parts) {
      throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Body multipart tidak valid' })
    }

    // Kumpulkan file parts dengan field name 'photos'
    const photoFiles: Array<{ name: string, type: string, size: number, data: Buffer }> = []
    for (const part of parts) {
      if (part.name === 'photos' && part.filename && part.data) {
        photoFiles.push({
          name: part.filename,
          type: part.type ?? 'application/octet-stream',
          size: part.data.length,
          data: part.data
        })
      }
    }

    if (photoFiles.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No files',
        message: 'Tidak ada file yang diunggah. Gunakan field "photos" pada form.'
      })
    }

    // Validasi: total <= MAX
    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)`.as('c') })
      .from(attachments)
      .where(and(eq(attachments.entityType, 'claim'), eq(attachments.entityId, claimId)))
    const existingCount = Number(countRow?.count ?? 0)
    if (existingCount + photoFiles.length > MAX_ISSUE_PHOTOS_PER_CLAIM) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Too many photos',
        message: `Maksimal ${MAX_ISSUE_PHOTOS_PER_CLAIM} foto per claim. Saat ini sudah ada ${existingCount} foto.`
      })
    }

    // Upload + insert. Compensating cleanup jika salah satu gagal.
    const saved: Array<{ relativePath: string, fileName: string, mimeType: typeof attachments.$inferSelect.mimeType, fileSize: number }> = []
    const insertedIds: number[] = []

    try {
      for (const file of photoFiles) {
        if (!isAllowedMimeType(file.type)) {
          throw new StorageError(
            `Format ${file.name} tidak didukung. Gunakan JPEG, PNG, atau WebP.`,
            'UNSUPPORTED_MIME'
          )
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new StorageError(
            `Ukuran ${file.name} melebihi batas ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`,
            'FILE_TOO_LARGE'
          )
        }
        const result = await saveFile(
          { name: file.name, type: file.type, size: file.size, data: file.data },
          'claim',
          claimId
        )
        saved.push(result)
        const ins = await db.insert(attachments).values({
          entityType: 'claim',
          entityId: claimId,
          fileName: result.fileName,
          filePath: result.relativePath,
          mimeType: result.mimeType,
          fileSize: result.fileSize,
          uploadedBy: user.id
        }).returning({ id: attachments.id })
        if (ins[0]) insertedIds.push(ins[0].id)
      }
    } catch (error) {
      // Cleanup: hapus file yang sudah terlanjur ditulis
      for (const f of saved) {
        try { await deleteFile(f.relativePath) }
        catch (e) { console.error('[photos.POST] cleanup file failed:', e) }
      }
      // Hapus attachment rows yang sudah ter-insert (best-effort)
      for (const id of insertedIds) {
        try { await db.delete(attachments).where(eq(attachments.id, id)) }
        catch (e) { console.error('[photos.POST] cleanup row failed:', e) }
      }

      if (error instanceof StorageError) {
        throw createError({ statusCode: 400, statusMessage: 'Upload failed', message: error.message })
      }
      console.error('[photos.POST] failed:', error)
      throw createError({ statusCode: 500, statusMessage: 'Photo upload failed', message: 'Gagal mengunggah foto' })
    }

    setResponseStatus(event, 201)

    // Return list terbaru
    const rows = await db
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
      .where(and(eq(attachments.entityType, 'claim'), eq(attachments.entityId, claimId)))
      .orderBy(asc(attachments.uploadedAt))

    return {
      success: true,
      data: rows.map((row) => serializeIssuePhoto({
        ...row,
        uploadedByName: row.uploadedByName ?? null
      }))
    }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
