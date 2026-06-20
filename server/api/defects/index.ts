import { desc, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import { defects, defectCategories } from '../../database/schema'
import { requireAccess } from '../../utils/rbac'

const defectSchema = z.object({
  code: z.string().trim().min(1, 'Kode defect wajib diisi').max(32, 'Kode defect maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama defect wajib diisi').max(120, 'Nama defect maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional().nullable(),
  categoryId: z.number().int().positive('Kategori defect wajib dipilih'),
  isActive: z.boolean().default(true)
})

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

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    await requireAccess(event, 'master', 'view')

    const query = getQuery(event)
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status : 'all'
    const categoryIdParam = typeof query.categoryId === 'string' ? Number(query.categoryId) : null

    const rows = await db
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
      .orderBy(desc(defects.createdAt))

    return {
      success: true,
      data: rows
        .filter((defect) => {
          const matchesSearch = !search
            || defect.code.toLowerCase().includes(search)
            || defect.name.toLowerCase().includes(search)
          const matchesStatus = status === 'all'
            || (status === 'active' && defect.isActive)
            || (status === 'inactive' && !defect.isActive)
          const matchesCategory = categoryIdParam === null || Number.isNaN(categoryIdParam)
            || defect.categoryId === categoryIdParam

          return matchesSearch && matchesStatus && matchesCategory
        })
        .map(serializeDefect)
    }
  }

  if (event.method === 'POST') {
    const user = await requireAccess(event, 'master', 'manage')

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
      const [createdDefect] = await db.insert(defects).values({
        ...parsed.data,
        description: parsed.data.description ?? null,
        createdBy: user.id,
        updatedBy: user.id
      }).returning()

      if (!createdDefect) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Defect save failed',
          message: 'Defect gagal dibuat'
        })
      }

      setResponseStatus(event, 201)

      const [category] = await db
        .select({ name: defectCategories.name })
        .from(defectCategories)
        .where(eq(defectCategories.id, createdDefect.categoryId))
        .limit(1)

      return {
        success: true,
        data: serializeDefect({
          ...createdDefect,
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

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
