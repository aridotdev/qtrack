import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import { defects, defectCategories } from '../../database/schema'
import { requireAccess } from '../../utils/rbac'
import { assertNotUsedInClaims } from '../../utils/master-guard'

const defectSchema = z.object({
  code: z.string().trim().min(1, 'Kode defect wajib diisi').max(32, 'Kode defect maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama defect wajib diisi').max(120, 'Nama defect maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional().nullable(),
  categoryId: z.number().int().positive('Kategori defect wajib dipilih'),
  isActive: z.boolean().default(true)
})

function getDefectId(event: H3Event) {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid defect id',
      message: 'ID defect tidak valid'
    })
  }

  return id
}

function serializeDefect(row: typeof defects.$inferSelect & { categoryName: string | null }) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    isActive: row.isActive,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function getDatabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('UNIQUE')) {
    return 'Kode defect sudah digunakan atau nama defect sudah ada di kategori ini'
  }

  if (error instanceof Error && error.message.includes('FOREIGN')) {
    return 'Kategori defect tidak ditemukan'
  }

  return 'Gagal menyimpan defect'
}

async function findDefect(id: number) {
  const [row] = await db
    .select({
      id: defects.id,
      code: defects.code,
      name: defects.name,
      description: defects.description,
      categoryId: defects.categoryId,
      isActive: defects.isActive,
      createdBy: defects.createdBy,
      updatedBy: defects.updatedBy,
      createdAt: defects.createdAt,
      updatedAt: defects.updatedAt,
      categoryName: defectCategories.name
    })
    .from(defects)
    .leftJoin(defectCategories, eq(defects.categoryId, defectCategories.id))
    .where(eq(defects.id, id))
    .limit(1)

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Defect not found',
      message: 'Defect tidak ditemukan'
    })
  }

  return row
}

export default defineEventHandler(async (event) => {
  const id = getDefectId(event)

  if (event.method === 'GET') {
    await requireAccess(event, 'master', 'view')

    const defect = await findDefect(id)

    return {
      success: true,
      data: serializeDefect(defect)
    }
  }

  if (event.method === 'PUT') {
    const user = await requireAccess(event, 'master', 'manage')
    await findDefect(id)

    const body = await readBody(event)
    const parsed = defectSchema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data defect belum valid',
        data: parsed.error.flatten()
      })
    }

    try {
      const [updatedDefect] = await db.update(defects)
        .set({
          ...parsed.data,
          description: parsed.data.description ?? null,
          updatedBy: user.id,
          updatedAt: new Date()
        })
        .where(eq(defects.id, id))
        .returning()

      if (!updatedDefect) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Defect save failed',
          message: 'Defect gagal diperbarui'
        })
      }

      const [category] = await db
        .select({ name: defectCategories.name })
        .from(defectCategories)
        .where(eq(defectCategories.id, updatedDefect.categoryId))
        .limit(1)

      return {
        success: true,
        data: serializeDefect({
          ...updatedDefect,
          categoryName: category?.name ?? null
        })
      }
    } catch (error) {
      throw createError({
        statusCode: error instanceof Error && (error.message.includes('UNIQUE') || error.message.includes('FOREIGN')) ? 409 : 500,
        statusMessage: 'Defect save failed',
        message: getDatabaseErrorMessage(error)
      })
    }
  }

  if (event.method === 'DELETE') {
    const user = await requireAccess(event, 'master', 'manage')
    await findDefect(id)

    // Task 3.3 — Cegah soft-delete jika defect dipakai di claim manapun.
    await assertNotUsedInClaims({ defectId: id })

    const [deletedDefect] = await db.update(defects)
      .set({
        isActive: false,
        updatedBy: user.id,
        updatedAt: new Date()
      })
      .where(eq(defects.id, id))
      .returning()

    if (!deletedDefect) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Defect delete failed',
        message: 'Defect gagal dinonaktifkan'
      })
    }

    const [category] = await db
      .select({ name: defectCategories.name })
      .from(defectCategories)
      .where(eq(defectCategories.id, deletedDefect.categoryId))
      .limit(1)

    return {
      success: true,
      data: serializeDefect({
        ...deletedDefect,
        categoryName: category?.name ?? null
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
