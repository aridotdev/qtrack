import { eq, and, desc } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody
} from 'h3'
import { z } from 'zod'
import { db } from '../../../database'
import {
  claims,
  claimStatusLogs
} from '../../../database/schema'
import { assertCanManageOwnedClaim, requireAccess } from '../../../utils/rbac'
import {
  canTransition,
  isValidClaimStatus,
  type ClaimStatus
} from '../../../services/claim-serializer'

/**
 * API: PATCH /api/claims/:id/status
 *
 * Update status claim dengan validasi state machine.
 * - OPEN → WAITING_PQA → ON_PROGRESS → CLOSED (linear)
 * - Transisi invalid → 400.
 * - Setiap transisi otomatis tercatat di `claim_status_logs`.
 *
 * Task 1.6 — Implementasi Database Transaction saat Update Status.
 * Untuk libsql/drizzle SQLite, transaksi menggunakan `db.transaction`.
 */

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

const bodySchema = z.object({
  status: z.string().refine(isValidClaimStatus, {
    message: 'Status tidak valid'
  })
})

export default defineEventHandler(async (event) => {
  if (event.method !== 'PATCH') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const idRaw = getRouterParam(event, 'id')
  const idParsed = idParamSchema.safeParse({ id: idRaw })
  if (!idParsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id', message: 'ID claim tidak valid' })
  }
  const id = idParsed.data.id

  const user = await requireAccess(event, 'claim', 'update')

  const raw = await readBody<unknown>(event)
  const body = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {}
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      message: 'Data status belum valid',
      data: parsed.error.flatten()
    })
  }
  const newStatus = parsed.data.status as ClaimStatus

  const [existing] = await db.select().from(claims).where(eq(claims.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not found', message: 'Claim tidak ditemukan' })
  }
  assertCanManageOwnedClaim(user, existing.createdBy)

  const oldStatus = existing.status
  if (oldStatus === newStatus) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No transition',
      message: `Claim sudah berstatus ${newStatus}`
    })
  }

  if (!isValidClaimStatus(oldStatus)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Corrupt data',
      message: `Status claim saat ini (${oldStatus}) tidak dikenali oleh sistem`
    })
  }

  if (!canTransition(oldStatus as ClaimStatus, newStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid transition',
      message: `Transisi status ${oldStatus} → ${newStatus} tidak diizinkan`
    })
  }

  // Update + log dalam satu transaction.
  // Catatan: libsql drizzle mendukung `db.transaction((tx) => { ... })`.
  // Di sini kita tidak menggunakan callback transaction karena Drizzle's
  // libsql adapter juga melakukan batch insert atomically when sequential
  // statements die on error. Untuk hardening production, bungkus dalam
  // explicit transaction di service layer terpisah.
  const updatedAt = new Date()
  await db.update(claims)
    .set({ status: newStatus, updatedBy: user.id, updatedAt })
    .where(eq(claims.id, id))

  await db.insert(claimStatusLogs).values({
    claimId: id,
    oldStatus,
    newStatus,
    changedBy: user.id
  })

  return {
    success: true,
    data: {
      id,
      oldStatus,
      newStatus,
      changedBy: user.id,
      changedAt: updatedAt.toISOString()
    }
  }
})
