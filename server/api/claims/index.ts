import { desc, eq, sql, and, or } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getQuery,
  readMultipartFormData,
  readBody,
  setResponseStatus
} from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import {
  claims,
  claimProgressLogs,
  attachments,
  products,
  productModels,
  defects,
  user as userSchema
} from '../../database/schema'
import { requireAccess } from '../../utils/rbac'
import { serializeClaim } from '../../services/claim-serializer'
import { generateUniqueClaimCode } from '../../services/claim-code'
import {
  saveFile,
  deleteFile,
  isAllowedMimeType,
  MAX_FILE_SIZE,
  StorageError
} from '../../services/storage'

/**
 * API: /api/claims
 *
 *  - GET   : list claim dengan filter (search, status, productId, dll).
 *  - POST  : buat claim baru.
 *           Body boleh JSON (tanpa foto) ATAU multipart/form-data (dengan
 *           Issue Photos).
 *
 * Response shape (lihat `app/types/claim.ts`):
 *   { success: true, data: Claim[] }   // GET
 *   { success: true, data: Claim }     // POST
 */

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const claimBodySchema = z.object({
  productId: z.number({ message: 'Produk wajib dipilih' }).int().positive('Produk wajib dipilih'),
  modelId: z.number({ message: 'Model wajib dipilih' }).int().positive('Model wajib dipilih'),
  defectId: z.number({ message: 'Defect wajib dipilih' }).int().positive('Defect wajib dipilih'),
  source: z.string().trim().min(1, 'Sumber claim wajib diisi').max(120, 'Sumber claim maksimal 120 karakter'),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(2000, 'Deskripsi maksimal 2000 karakter')
})

/** Batas jumlah foto per claim (lihat spec §2.4.1). */
export const MAX_ISSUE_PHOTOS_PER_CLAIM = 5

// ---------------------------------------------------------------------------
// Query helper: counts via scalar subquery
// ---------------------------------------------------------------------------

/** Subquery: jumlah attachment per claim (entity_type='claim'). */
const photoCountSq = db
  .select({
    claimId: attachments.entityId,
    count: sql<number>`COUNT(*)`.as('photo_count')
  })
  .from(attachments)
  .where(eq(attachments.entityType, 'claim'))
  .groupBy(attachments.entityId)
  .as('photo_count_sq')

/** Subquery: jumlah progress log per claim. */
const progressCountSq = db
  .select({
    claimId: claimProgressLogs.claimId,
    count: sql<number>`COUNT(*)`.as('progress_count')
  })
  .from(claimProgressLogs)
  .groupBy(claimProgressLogs.claimId)
  .as('progress_count_sq')

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default defineEventHandler(async (event) => {
  // ---------------------------------------------------------------------
  // GET — list claim
  // ---------------------------------------------------------------------
  if (event.method === 'GET') {
    await requireAccess(event, 'claim', 'read')

    const q = getQuery(event) as Record<string, unknown>
    const search = typeof q.search === 'string' ? q.search.trim().toLowerCase() : ''
    const statusFilter = typeof q.status === 'string' ? q.status : 'all'
    const productId = typeof q.productId === 'string' ? Number(q.productId) : null
    const modelId = typeof q.modelId === 'string' ? Number(q.modelId) : null
    const defectId = typeof q.defectId === 'string' ? Number(q.defectId) : null

    const rows = await db
      .select({
        id: claims.id,
        claimCode: claims.claimCode,
        productId: claims.productId,
        modelId: claims.modelId,
        defectId: claims.defectId,
        source: claims.source,
        description: claims.description,
        status: claims.status,
        createdBy: claims.createdBy,
        updatedBy: claims.updatedBy,
        createdAt: claims.createdAt,
        updatedAt: claims.updatedAt,
        productName: products.name,
        productCode: products.code,
        modelName: productModels.name,
        modelSku: productModels.sku,
        defectName: defects.name,
        defectCode: defects.code,
        createdByName: userSchema.name,
        photoCount: photoCountSq.count,
        progressLogCount: progressCountSq.count
      })
      .from(claims)
      .leftJoin(products, eq(claims.productId, products.id))
      .leftJoin(productModels, eq(claims.modelId, productModels.id))
      .leftJoin(defects, eq(claims.defectId, defects.id))
      .leftJoin(userSchema, eq(claims.createdBy, userSchema.id))
      .leftJoin(photoCountSq, eq(photoCountSq.claimId, claims.id))
      .leftJoin(progressCountSq, eq(progressCountSq.claimId, claims.id))
      .orderBy(desc(claims.createdAt))

    const filtered = rows.filter((row) => {
      // Status
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      // FK filters
      if (productId !== null && !Number.isNaN(productId) && row.productId !== productId) return false
      if (modelId !== null && !Number.isNaN(modelId) && row.modelId !== modelId) return false
      if (defectId !== null && !Number.isNaN(defectId) && row.defectId !== defectId) return false
      // Search across joined fields
      if (search) {
        const haystack = [
          row.claimCode,
          row.source,
          row.productName ?? '',
          row.productCode ?? '',
          row.modelName ?? '',
          row.modelSku ?? '',
          row.defectName ?? '',
          row.defectCode ?? ''
        ].join(' ').toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    })

    return {
      success: true,
      data: filtered.map((row) => serializeClaim({
        ...row,
        updatedByName: null, // join kedua user untuk updatedBy belum diimpl
        photoCount: Number(row.photoCount ?? 0),
        progressLogCount: Number(row.progressLogCount ?? 0)
      }))
    }
  }

  // ---------------------------------------------------------------------
  // POST — create claim (dengan/tanpa Issue Photos)
  // ---------------------------------------------------------------------
  if (event.method === 'POST') {
    const user = await requireAccess(event, 'claim', 'create')

    const contentType = (event.node.req.headers['content-type'] ?? '').toString()
    let body: Record<string, unknown> = {}
    const photoFiles: Array<{ name: string, type: string, size: number, data: Buffer }> = []

    if (contentType.includes('multipart/form-data')) {
      const parts = await readMultipartFormData(event)
      if (!parts) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: 'Body multipart tidak valid'
        })
      }
      const fields: Record<string, string> = {}
      for (const part of parts) {
        if (!part.name) continue
        if (part.filename && part.data) {
          photoFiles.push({
            name: part.filename,
            type: part.type ?? 'application/octet-stream',
            size: part.data.length,
            data: part.data
          })
        } else if (part.data) {
          fields[part.name] = part.data.toString('utf-8')
        }
      }
      body = {
        productId: fields.productId ? Number(fields.productId) : undefined,
        modelId: fields.modelId ? Number(fields.modelId) : undefined,
        defectId: fields.defectId ? Number(fields.defectId) : undefined,
        source: fields.source,
        description: fields.description
      }
    } else {
      const raw = await readBody<unknown>(event)
      body = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {}
    }

    if (photoFiles.length > MAX_ISSUE_PHOTOS_PER_CLAIM) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Too many photos',
        message: `Maksimal ${MAX_ISSUE_PHOTOS_PER_CLAIM} foto per claim`
      })
    }

    const parsed = claimBodySchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data claim belum valid',
        data: parsed.error.flatten()
      })
    }

    // Validasi FK master data
    const [product] = await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1)
    if (!product || !product.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid product', message: 'Produk tidak ditemukan atau tidak aktif' })
    }
    const [model] = await db.select().from(productModels).where(eq(productModels.id, parsed.data.modelId)).limit(1)
    if (!model || !model.isActive || model.productId !== product.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid model', message: 'Model tidak ditemukan, tidak aktif, atau bukan milik produk yang dipilih' })
    }
    const [defect] = await db.select().from(defects).where(eq(defects.id, parsed.data.defectId)).limit(1)
    if (!defect || !defect.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid defect', message: 'Defect tidak ditemukan atau tidak aktif' })
    }

    // Generate unique claim code
    let generated
    try {
      generated = await generateUniqueClaimCode()
    } catch (error) {
      console.error('[claims.POST] generateUniqueClaimCode failed:', error)
      throw createError({ statusCode: 500, statusMessage: 'Claim code generation failed', message: 'Gagal membuat kode claim otomatis. Coba lagi.' })
    }

    // Insert claim → save files → insert attachments.
    // Compensating cleanup on failure.
    let createdClaim: typeof claims.$inferSelect | undefined
    const savedFiles: Array<{ relativePath: string }> = []

    try {
      const inserted = await db.insert(claims).values({
        claimCode: generated.code,
        productId: parsed.data.productId,
        modelId: parsed.data.modelId,
        defectId: parsed.data.defectId,
        source: parsed.data.source,
        description: parsed.data.description,
        status: 'OPEN',
        createdBy: user.id,
        updatedBy: user.id
      }).returning()
      createdClaim = inserted[0]
      if (!createdClaim) throw new Error('Insert returned no row')

      // Simpan foto (validasi satu per satu agar error message informatif)
      for (const file of photoFiles) {
        if (!isAllowedMimeType(file.type)) {
          throw new StorageError(`Format ${file.name} tidak didukung. Gunakan JPEG, PNG, atau WebP.`, 'UNSUPPORTED_MIME')
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new StorageError(`Ukuran ${file.name} melebihi batas ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`, 'FILE_TOO_LARGE')
        }
        const saved = await saveFile(
          { name: file.name, type: file.type, size: file.size, data: file.data },
          'claim',
          createdClaim.id
        )
        savedFiles.push({ relativePath: saved.relativePath })
        await db.insert(attachments).values({
          entityType: 'claim',
          entityId: createdClaim.id,
          fileName: saved.fileName,
          filePath: saved.relativePath,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          uploadedBy: user.id
        })
      }
    } catch (error) {
      // Compensating cleanup: hapus claim + file
      if (createdClaim) {
        try { await db.delete(claims).where(eq(claims.id, createdClaim.id)) }
        catch (e) { console.error('[claims.POST] cleanup claim failed:', e) }
      }
      for (const f of savedFiles) {
        try { await deleteFile(f.relativePath) }
        catch (e) { console.error('[claims.POST] cleanup file failed:', e) }
      }

      if (error instanceof StorageError) {
        throw createError({ statusCode: 400, statusMessage: 'Upload failed', message: error.message })
      }
      console.error('[claims.POST] failed:', error)
      throw createError({ statusCode: 500, statusMessage: 'Claim save failed', message: 'Gagal membuat claim. Coba lagi.' })
    }

    // Fetch ulang untuk response dengan relasi
    const fullRows = await db
      .select({
        id: claims.id,
        claimCode: claims.claimCode,
        productId: claims.productId,
        modelId: claims.modelId,
        defectId: claims.defectId,
        source: claims.source,
        description: claims.description,
        status: claims.status,
        createdBy: claims.createdBy,
        updatedBy: claims.updatedBy,
        createdAt: claims.createdAt,
        updatedAt: claims.updatedAt,
        productName: products.name,
        productCode: products.code,
        modelName: productModels.name,
        modelSku: productModels.sku,
        defectName: defects.name,
        defectCode: defects.code,
        createdByName: userSchema.name
      })
      .from(claims)
      .leftJoin(products, eq(claims.productId, products.id))
      .leftJoin(productModels, eq(claims.modelId, productModels.id))
      .leftJoin(defects, eq(claims.defectId, defects.id))
      .leftJoin(userSchema, eq(claims.createdBy, userSchema.id))
      .where(eq(claims.id, createdClaim.id))
      .limit(1)

    const full = fullRows[0]
    if (!full) {
      throw createError({ statusCode: 500, statusMessage: 'Internal', message: 'Gagal membaca claim yang baru dibuat' })
    }

    setResponseStatus(event, 201)
    return {
      success: true,
      data: serializeClaim({
        ...full,
        updatedByName: null,
        photoCount: photoFiles.length,
        progressLogCount: 0
      })
    }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
