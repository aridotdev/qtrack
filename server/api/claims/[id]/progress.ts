import { eq, asc, and } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus
} from 'h3'
import { z } from 'zod'
import { db } from '../../../database'
import {
  claims,
  claimProgressLogs,
  user as userSchema
} from '../../../database/schema'
import { assertCanManageOwnedClaim, requireAccess } from '../../../utils/rbac'
import { serializeProgressLog } from '../../../services/claim-serializer'

/**
 * API: /api/claims/:id/progress
 *
 *  - GET  : list progress log untuk claim, diurut ASC by progressDate
 *           (kronologis naik — lihat spec §2.5).
 *  - POST : tambah progress log baru. `notes` adalah HTML string
 *           (output dari Rich Text Editor, lihat Task 2.4).
 *           HTML divalidasi basic (tidak kosong, max length).
 *           Sanitasi full dilakukan di render-time oleh klien
 *           (lihat catatan di client).
 */

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

const postSchema = z.object({
  progressDate: z.number({ message: 'Tanggal progres wajib diisi' })
    .int()
    .positive('Tanggal progres tidak valid'),
  notes: z.string()
    .trim()
    .min(1, 'Catatan progres wajib diisi')
    .max(20000, 'Catatan progres maksimal 20.000 karakter')
})

export default defineEventHandler(async (event) => {
  const idRaw = getRouterParam(event, 'id')
  const idParsed = idParamSchema.safeParse({ id: idRaw })
  if (!idParsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id', message: 'ID claim tidak valid' })
  }
  const id = idParsed.data.id

  // GET — list
  if (event.method === 'GET') {
    await requireAccess(event, 'claim', 'read')

    const [claim] = await db.select({ id: claims.id }).from(claims).where(eq(claims.id, id)).limit(1)
    if (!claim) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }

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
      .where(eq(claimProgressLogs.claimId, id))
      .orderBy(asc(claimProgressLogs.progressDate))

    return {
      success: true,
      data: rows.map((row) => serializeProgressLog({
        ...row,
        createdByName: row.createdByName ?? null
      }))
    }
  }

  // POST — create
  if (event.method === 'POST') {
    const user = await requireAccess(event, 'claim', 'update')

    const [claim] = await db.select({ id: claims.id, createdBy: claims.createdBy }).from(claims).where(eq(claims.id, id)).limit(1)
    if (!claim) {
      throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
    }
    assertCanManageOwnedClaim(user, claim.createdBy)

    const raw = await readBody<unknown>(event)
    const body = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {}
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data jurnal progres belum valid',
        data: parsed.error.flatten()
      })
    }

    const inserted = await db.insert(claimProgressLogs).values({
      claimId: id,
      progressDate: new Date(parsed.data.progressDate),
      notes: parsed.data.notes,
      createdBy: user.id
    }).returning()

    const created = inserted[0]
    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Progress save failed', message: 'Gagal menyimpan jurnal progres' })
    }

    setResponseStatus(event, 201)

    return {
      success: true,
      data: serializeProgressLog({
        ...created,
        createdByName: user.name ?? null
      })
    }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
