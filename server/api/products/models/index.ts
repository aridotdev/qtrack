import { desc, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { db } from '../../../database'
import { productModels, products } from '../../../database/schema'
import { requireAccess } from '../../../utils/rbac'

const modelSchema = z.object({
  sku: z.string().trim().min(1, 'SKU model wajib diisi').max(64, 'SKU model maksimal 64 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama model wajib diisi').max(120, 'Nama model maksimal 120 karakter'),
  productId: z.number({ message: 'Produk wajib dipilih' }).int().positive('Produk wajib dipilih'),
  isActive: z.boolean().default(true)
})

function serializeModel(row: typeof productModels.$inferSelect & { productCode: string | null, productName: string | null }) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    productId: row.productId,
    productCode: row.productCode,
    productName: row.productName,
    isActive: row.isActive,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function getDatabaseErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('UNIQUE')) {
    return 'SKU model sudah digunakan atau nama model sudah ada di produk ini'
  }

  if (error instanceof Error && error.message.includes('FOREIGN')) {
    return 'Produk tidak ditemukan'
  }

  return 'Gagal menyimpan model'
}

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    await requireAccess(event, 'master', 'view')

    const query = getQuery(event)
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''
    const status = typeof query.status === 'string' ? query.status : 'all'
    const productIdParam = typeof query.productId === 'string' ? Number(query.productId) : null

    const rows = await db
      .select({
        id: productModels.id,
        sku: productModels.sku,
        name: productModels.name,
        productId: productModels.productId,
        isActive: productModels.isActive,
        createdBy: productModels.createdBy,
        updatedBy: productModels.updatedBy,
        createdAt: productModels.createdAt,
        updatedAt: productModels.updatedAt,
        productCode: products.code,
        productName: products.name
      })
      .from(productModels)
      .leftJoin(products, eq(productModels.productId, products.id))
      .orderBy(desc(productModels.createdAt))

    return {
      success: true,
      data: rows
        .filter((model) => {
          const matchesSearch = !search
            || model.sku.toLowerCase().includes(search)
            || model.name.toLowerCase().includes(search)
            || (model.productCode?.toLowerCase().includes(search) ?? false)
            || (model.productName?.toLowerCase().includes(search) ?? false)
          const matchesStatus = status === 'all'
            || (status === 'active' && model.isActive)
            || (status === 'inactive' && !model.isActive)
          const matchesProduct = productIdParam === null || Number.isNaN(productIdParam)
            || model.productId === productIdParam

          return matchesSearch && matchesStatus && matchesProduct
        })
        .map(serializeModel)
    }
  }

  if (event.method === 'POST') {
    const user = await requireAccess(event, 'master', 'manage')

    const body = await readBody(event)
    const parsed = modelSchema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        message: 'Data model belum valid',
        data: parsed.error.flatten()
      })
    }

    try {
      const [createdModel] = await db.insert(productModels).values({
        ...parsed.data,
        createdBy: user.id,
        updatedBy: user.id
      }).returning()

      if (!createdModel) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Model save failed',
          message: 'Model gagal dibuat'
        })
      }

      setResponseStatus(event, 201)

      const [product] = await db
        .select({ code: products.code, name: products.name })
        .from(products)
        .where(eq(products.id, createdModel.productId))
        .limit(1)

      return {
        success: true,
        data: serializeModel({
          ...createdModel,
          productCode: product?.code ?? null,
          productName: product?.name ?? null
        })
      }
    } catch (error) {
      throw createError({
        statusCode: error instanceof Error && (error.message.includes('UNIQUE') || error.message.includes('FOREIGN')) ? 409 : 500,
        statusMessage: 'Model save failed',
        message: getDatabaseErrorMessage(error)
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
