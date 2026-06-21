import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import { defectCategories } from '../../database/schema'
import { requireAccess } from '../../utils/rbac'
import { assertNotUsedInClaims } from '../../utils/master-guard'

const categorySchema = z.object({
  code: z.string().trim().min(1, 'Kode kategori wajib diisi').max(32, 'Kode kategori maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(120, 'Nama kategori maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional().nullable(),
  isActive: z.boolean().default(true)
})

function getCategoryId(event: H3Event) {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid category id',
      message: 'ID kategori tidak valid'
    })
  }

  return id
}

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

  if (error instanceof Error && error.message.includes('FOREIGN')) {
    return 'Kategori tidak bisa dihapus karena masih ada defect aktif di dalamnya'
  }

  return 'Gagal menyimpan kategori defect'
}

async function findCategory(id: number) {
  const [category] = await db.select().from(defectCategories).where(eq(defectCategories.id, id)).limit(1)

  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found',
      message: 'Kategori defect tidak ditemukan'
    })
  }

  return category
}

export default defineEventHandler(async (event) => {
  const id = getCategoryId(event)

  if (event.method === 'GET') {
    await requireAccess(event, 'master', 'view')

    const category = await findCategory(id)

    return {
      success: true,
      data: serializeCategory(category)
    }
  }

  if (event.method === 'PUT') {
    const user = await requireAccess(event, 'master', 'manage')
    await findCategory(id)

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
      const [updatedCategory] = await db.update(defectCategories)
        .set({
          ...parsed.data,
          description: parsed.data.description ?? null,
          updatedBy: user.id,
          updatedAt: new Date()
        })
        .where(eq(defectCategories.id, id))
        .returning()

      if (!updatedCategory) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Category save failed',
          message: 'Kategori defect gagal diperbarui'
        })
      }

      return {
        success: true,
        data: serializeCategory(updatedCategory)
      }
    } catch (error) {
      throw createError({
        statusCode: error instanceof Error && error.message.includes('UNIQUE') ? 409 : 500,
        statusMessage: 'Category save failed',
        message: getDatabaseErrorMessage(error)
      })
    }
  }

  if (event.method === 'DELETE') {
    const user = await requireAccess(event, 'master', 'manage')
    await findCategory(id)

    // Task 3.3 — Cegah soft-delete jika masih ada defect aktif di kategori ini.
    // Sebelumnya, logika ini hanya andalkan deteksi FOREIGN KEY error dari
    // catch block, yang memberikan pesan kurang informatif. Guard eksplisit
    // memberikan error 409 + pesan spesifik sebelum mencoba update.
    await assertNotUsedInClaims({ categoryId: id })

    const [deletedCategory] = await db.update(defectCategories)
      .set({
        isActive: false,
        updatedBy: user.id,
        updatedAt: new Date()
      })
      .where(eq(defectCategories.id, id))
      .returning()

    if (!deletedCategory) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Category delete failed',
        message: 'Kategori defect gagal dinonaktifkan'
      })
    }

    return {
      success: true,
      data: serializeCategory(deletedCategory)
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
