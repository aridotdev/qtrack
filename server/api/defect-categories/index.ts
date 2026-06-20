import { desc } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import { defectCategories } from '../../database/schema'
import { requireAccess } from '../../utils/rbac'

const categorySchema = z.object({
  code: z.string().trim().min(1, 'Kode kategori wajib diisi').max(32, 'Kode kategori maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(120, 'Nama kategori maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional().nullable(),
  isActive: z.boolean().default(true)
})

function serializeCategory(category: typeof defectCategories.$inferSelect) {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    createdBy: category.createdBy,
    updatedBy: category.updatedBy,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  }
}

function getDatabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('UNIQUE')) {
    return 'Kode atau nama kategori sudah digunakan'
  }

  return 'Gagal menyimpan kategori defect'
}

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    await requireAccess(event, 'master', 'view')

    const query = getQuery(event)
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status : 'all'

    const rows = await db.select().from(defectCategories).orderBy(desc(defectCategories.createdAt))

    return {
      success: true,
      data: rows
        .filter((category) => {
          const matchesSearch = !search
            || category.code.toLowerCase().includes(search)
            || category.name.toLowerCase().includes(search)
          const matchesStatus = status === 'all'
            || (status === 'active' && category.isActive)
            || (status === 'inactive' && !category.isActive)

          return matchesSearch && matchesStatus
        })
        .map(serializeCategory)
    }
  }

  if (event.method === 'POST') {
    const user = await requireAccess(event, 'master', 'manage')

    const body = await readBody(event)
    const parsed = categorySchema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data kategori defect belum valid',
        data: parsed.error.flatten()
      })
    }

    try {
      const [createdCategory] = await db.insert(defectCategories).values({
        ...parsed.data,
        description: parsed.data.description ?? null,
        createdBy: user.id,
        updatedBy: user.id
      }).returning()

      if (!createdCategory) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Category save failed',
          message: 'Kategori defect gagal dibuat'
        })
      }

      setResponseStatus(event, 201)

      return {
        success: true,
        data: serializeCategory(createdCategory)
      }
    } catch (error) {
      throw createError({
        statusCode: error instanceof Error && error.message.includes('UNIQUE') ? 409 : 500,
        statusMessage: 'Category save failed',
        message: getDatabaseErrorMessage(error)
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
