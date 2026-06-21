import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
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

function getModelId(event: H3Event) {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid model id',
      message: 'ID model tidak valid'
    })
  }

  return id
}

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

async function findModel(id: number) {
  const [row] = await db
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
    .where(eq(productModels.id, id))
    .limit(1)

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Model not found',
      message: 'Model tidak ditemukan'
    })
  }

  return row
}

export default defineEventHandler(async (event) => {
  const id = getModelId(event)

  if (event.method === 'GET') {
    await requireAccess(event, 'master', 'view')

    const model = await findModel(id)

    return {
      success: true,
      data: serializeModel(model)
    }
  }

  if (event.method === 'PUT') {
    const user = await requireAccess(event, 'master', 'manage')
    await findModel(id)

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
      const [updatedModel] = await db.update(productModels)
        .set({
          ...parsed.data,
          updatedBy: user.id,
          updatedAt: new Date()
        })
        .where(eq(productModels.id, id))
        .returning()

      if (!updatedModel) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Model save failed',
          message: 'Model gagal diperbarui'
        })
      }

      const [product] = await db
        .select({ code: products.code, name: products.name })
        .from(products)
        .where(eq(products.id, updatedModel.productId))
        .limit(1)

      return {
        success: true,
        data: serializeModel({
          ...updatedModel,
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

  if (event.method === 'DELETE') {
    const user = await requireAccess(event, 'master', 'manage')
    await findModel(id)

    const [deletedModel] = await db.update(productModels)
      .set({
        isActive: false,
        updatedBy: user.id,
        updatedAt: new Date()
      })
      .where(eq(productModels.id, id))
      .returning()

    if (!deletedModel) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Model delete failed',
        message: 'Model gagal dinonaktifkan'
      })
    }

    const [product] = await db
      .select({ code: products.code, name: products.name })
      .from(products)
      .where(eq(products.id, deletedModel.productId))
      .limit(1)

    return {
      success: true,
      data: serializeModel({
        ...deletedModel,
        productCode: product?.code ?? null,
        productName: product?.name ?? null
      })
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
