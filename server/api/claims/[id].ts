import { desc, eq, sql, and } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
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
import { assertCanManageOwnedClaim, requireAccess } from '../../utils/rbac'
import { serializeClaim } from '../../services/claim-serializer'
import { deleteAllForEntity } from '../../services/storage'

/**
 * API: /api/claims/:id
 *
 *  - GET    : ambil detail satu claim.
 *  - PUT    : update field non-status (productId/modelId/defectId/source/description).
 *  - DELETE : hapus claim (hard delete). CASCADE:
 *             - claim_status_logs (FK CASCADE)
 *             - claim_progress_logs (FK CASCADE)
 *             - attachments rows dihapus manual sebelum claim agar file
 *               fisik juga ikut di-unlink.
 *
 * Endpoint terpisah untuk update status → `PATCH /api/claims/:id/status`
 * (Task 1.6).
 */

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

const updateSchema = z.object({
  productId: z.number().int().positive('Produk wajib dipilih').optional(),
  modelId: z.number().int().positive('Model wajib dipilih').optional(),
  defectId: z.number().int().positive('Defect wajib dipilih').optional(),
  source: z.string().trim().min(1, 'Sumber claim wajib diisi').max(120).optional(),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi').max(2000).optional()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClaimId(event: Parameters<Parameters<typeof defineEventHandler>[0]>[0]): number {
  const raw = getRouterParam(event, 'id')
  const parsed = idParamSchema.safeParse({ id: raw })
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid id',
      message: 'ID claim tidak valid'
    })
  }
  return parsed.data.id
}

/**
 * Fetch claim lengkap dengan relasi + counts.
 */
async function fetchClaimById(id: number) {
  const photoCountSq = db
    .select({ claimId: attachments.entityId, count: sql<number>`COUNT(*)`.as('c') })
    .from(attachments)
    .where(eq(attachments.entityType, 'claim'))
    .groupBy(attachments.entityId)
    .as('pc')

  const progressCountSq = db
    .select({ claimId: claimProgressLogs.claimId, count: sql<number>`COUNT(*)`.as('c') })
    .from(claimProgressLogs)
    .groupBy(claimProgressLogs.claimId)
    .as('plc')

  const [row] = await db
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
    .where(eq(claims.id, id))
    .limit(1)

  if (!row) return null

  return {
    ...row,
    updatedByName: null,
    photoCount: Number(row.photoCount ?? 0),
    progressLogCount: Number(row.progressLogCount ?? 0)
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default defineEventHandler(async (event) => {
  const id = getClaimId(event)

  if (event.method === 'GET') {
    await requireAccess(event, 'claim', 'read')
    const row = await fetchClaimById(id)
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }
    return { success: true, data: serializeClaim(row) }
  }

  if (event.method === 'PUT') {
    const user = await requireAccess(event, 'claim', 'update')

    const [existing] = await db.select().from(claims).where(eq(claims.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }
    assertCanManageOwnedClaim(user, existing.createdBy)

    const raw = await readBody<unknown>(event)
    const body = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {}
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data claim belum valid',
        data: parsed.error.flatten()
      })
    }

    const data = parsed.data
    // Validasi FK hanya jika field dikirim
    const targetProductId = data.productId ?? existing.productId
    const targetModelId = data.modelId ?? existing.modelId
    const targetDefectId = data.defectId ?? existing.defectId

    const [product] = await db.select().from(products).where(eq(products.id, targetProductId)).limit(1)
    if (!product || !product.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid product', message: 'Produk tidak ditemukan atau tidak aktif' })
    }
    const [model] = await db.select().from(productModels).where(eq(productModels.id, targetModelId)).limit(1)
    if (!model || !model.isActive || model.productId !== product.id) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid model', message: 'Model tidak ditemukan, tidak aktif, atau bukan milik produk yang dipilih' })
    }
    const [defect] = await db.select().from(defects).where(eq(defects.id, targetDefectId)).limit(1)
    if (!defect || !defect.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid defect', message: 'Defect tidak ditemukan atau tidak aktif' })
    }

    await db.update(claims)
      .set({
        ...(data.productId !== undefined ? { productId: data.productId } : {}),
        ...(data.modelId !== undefined ? { modelId: data.modelId } : {}),
        ...(data.defectId !== undefined ? { defectId: data.defectId } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updatedBy: user.id,
        updatedAt: new Date()
      })
      .where(eq(claims.id, id))

    const row = await fetchClaimById(id)
    if (!row) {
      throw createError({ statusCode: 500, statusMessage: 'Internal', message: 'Gagal membaca claim yang baru diupdate' })
    }
    return { success: true, data: serializeClaim(row) }
  }

  if (event.method === 'DELETE') {
    const user = await requireAccess(event, 'claim', 'delete')

    const [existing] = await db.select().from(claims).where(eq(claims.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }
    assertCanManageOwnedClaim(user, existing.createdBy)

    // Hapus attachments (DB) lalu file fisik.
    // Status logs & progress logs ikut CASCADE via FK.
    await db.delete(attachments)
      .where(and(eq(attachments.entityType, 'claim'), eq(attachments.entityId, id)))

    await db.delete(claims).where(eq(claims.id, id))

    // Hapus file fisik best-effort. Untuk 'claim', seluruh folder
    // bisa di-rm recursive.
    await deleteAllForEntity('claim', id)

    setResponseStatus(event, 204)
    return null
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
