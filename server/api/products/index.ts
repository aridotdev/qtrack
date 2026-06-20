import { desc } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import { products } from '../../database/schema'
import { requireAccess } from '../../utils/rbac'

const productSchema = z.object({
  code: z.string().trim().min(1, 'Kode produk wajib diisi').max(32, 'Kode produk maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama produk wajib diisi').max(120, 'Nama produk maksimal 120 karakter'),
  isActive: z.boolean().default(true)
})

function serializeProduct(product: typeof products.$inferSelect) {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    isActive: product.isActive,
    createdBy: product.createdBy,
    updatedBy: product.updatedBy,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  }
}

function getDatabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('UNIQUE')) {
    return 'Kode produk sudah digunakan'
  }

  return 'Gagal menyimpan produk'
}

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    const user = await requireAccess(event, 'master', 'view')

    const query = getQuery(event)
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status : 'all'

    const rows = await db.select().from(products).orderBy(desc(products.createdAt))

    return {
      success: true,
      data: rows
        .filter((product) => {
          const matchesSearch = !search
            || product.code.toLowerCase().includes(search)
            || product.name.toLowerCase().includes(search)
          const matchesStatus = status === 'all'
            || (status === 'active' && product.isActive)
            || (status === 'inactive' && !product.isActive)

          return matchesSearch && matchesStatus
        })
        .map(serializeProduct),
      // Echo acting user untuk audit/logging di klien bila dibutuhkan.
      actingUser: { id: user.id, name: user.name, role: user.role }
    }
  }

  if (event.method === 'POST') {
    const user = await requireAccess(event, 'master', 'manage')

    const body = await readBody(event)
    const parsed = productSchema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data produk belum valid',
        data: parsed.error.flatten()
      })
    }

    try {
      const [createdProduct] = await db.insert(products).values({
        ...parsed.data,
        createdBy: user.id,
        updatedBy: user.id
      }).returning()

      if (!createdProduct) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Product save failed',
          message: 'Produk gagal dibuat'
        })
      }

      setResponseStatus(event, 201)

      return {
        success: true,
        data: serializeProduct(createdProduct)
      }
    } catch (error) {
      throw createError({
        statusCode: error instanceof Error && error.message.includes('UNIQUE') ? 409 : 500,
        statusMessage: 'Product save failed',
        message: getDatabaseErrorMessage(error)
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
