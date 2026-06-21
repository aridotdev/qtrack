import { eq, and } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody
} from 'h3'
import { z } from 'zod'
import { db } from '../../../../database'
import {
  attachments,
  claims,
  claimProgressLogs,
  user as userSchema
} from '../../../../database/schema'
import { assertCanManageOwnedClaim, requireAccess } from '../../../../utils/rbac'
import { serializeProgressLog } from '../../../../services/claim-serializer'
import { deleteAllForEntity } from '../../../../services/storage'

/**
 * API: /api/claims/:id/progress/:progressId
 *
 *  - PUT    : update notes / progressDate dari satu progress log.
 *  - DELETE : hapus satu progress log.
 *
 * Hak akses: PUT/DELETE mengikuti policy claim:update (admin, qrcc).
 * Pembuat log + admin boleh edit; hanya admin atau creator boleh delete
 * (implementasi penuh di Task 3.2 — saat ini konsisten dengan update).
 */

const paramSchema = z.object({
  id: z.coerce.number().int().positive(),
  progressId: z.coerce.number().int().positive()
})

const putSchema = z.object({
  progressDate: z.number().int().positive().optional(),
  notes: z.string().trim().min(1).max(20000).optional()
})

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const progressIdRaw = getRouterParam(event, 'progressId')
  const params = paramSchema.safeParse({ id: idRaw, progressId: progressIdRaw })
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id', message: 'ID tidak valid' })
  }
  const { id: claimId, progressId } = params.data

  if (event.method === 'PUT') {
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

    const [existing] = await db
      .select()
      .from(claimProgressLogs)
      .where(and(eq(claimProgressLogs.id, progressId), eq(claimProgressLogs.claimId, claimId)))
      .limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Jurnal progres tidak ditemukan' })
    }

    const raw = await readBody<unknown>(event)
    const body = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {}
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data jurnal progres belum valid',
        data: parsed.error.flatten()
      })
    }
    if (parsed.data.progressDate === undefined && parsed.data.notes === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No changes',
        message: 'Tidak ada field yang diupdate'
      })
    }

    await db.update(claimProgressLogs)
      .set({
        ...(parsed.data.progressDate !== undefined
          ? { progressDate: new Date(parsed.data.progressDate) }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {})
      })
      .where(eq(claimProgressLogs.id, progressId))

    const rows = await db
      .select({
        id: claimProgressLogs.id,
        claimId: claimProgressLogs.claimId,
        progressDate: claimProgressLogs.progressDate,
        notes: claimProgressLogs.notes,
        createdBy: claimProgressLogs.createdBy,
        createdByName: userSchema.name,
        createdAt: claimProgressLogs.createdAt,
        updatedAt: claimProgressLogs.updatedAt
      })
      .from(claimProgressLogs)
      .leftJoin(userSchema, eq(claimProgressLogs.createdBy, userSchema.id))
      .where(eq(claimProgressLogs.id, progressId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw createError({ statusCode: 500, statusMessage: 'Internal', message: 'Gagal membaca jurnal yang baru diupdate' })
    }

    return {
      success: true,
      data: serializeProgressLog({
        ...row,
        createdByName: row.createdByName ?? null
      })
    }
  }

  if (event.method === 'DELETE') {
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

    const [existing] = await db
      .select()
      .from(claimProgressLogs)
      .where(and(eq(claimProgressLogs.id, progressId), eq(claimProgressLogs.claimId, claimId)))
      .limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Jurnal progres tidak ditemukan' })
    }

    await db.delete(attachments)
      .where(and(eq(attachments.entityType, 'claim_progress'), eq(attachments.entityId, progressId)))

    await db.delete(claimProgressLogs).where(eq(claimProgressLogs.id, progressId))
    await deleteAllForEntity('claim_progress', progressId)

    return {
      success: true,
      data: { id: progressId }
    }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
