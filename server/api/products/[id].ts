import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { db } from '../../database'
import { products } from '../../database/schema'

const SYSTEM_USER_ID = 'system'

const productSchema = z.object({
  code: z.string().trim().min(1, 'Kode produk wajib diisi').max(32, 'Kode produk maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama produk wajib diisi').max(120, 'Nama produk maksimal 120 karakter'),
  isActive: z.boolean().default(true)
})

function getProductId(event: H3Event) {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid product id',
      message: 'ID produk tidak valid'
    })
  }

  return id
}

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

async function findProduct(id: number) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
      message: 'Produk tidak ditemukan'
    })
  }

  return product
}

export default defineEventHandler(async (event) => {
  const id = getProductId(event)

  if (event.method === 'GET') {
    const product = await findProduct(id)

    return {
      success: true,
      data: serializeProduct(product)
    }
  }

  if (event.method === 'PUT') {
    await findProduct(id)

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
      const [updatedProduct] = await db.update(products)
        .set({
          ...parsed.data,
          updatedBy: SYSTEM_USER_ID,
          updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning()

      if (!updatedProduct) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Product save failed',
          message: 'Produk gagal diperbarui'
        })
      }

      return {
        success: true,
        data: serializeProduct(updatedProduct)
      }
    } catch (error) {
      throw createError({
        statusCode: error instanceof Error && error.message.includes('UNIQUE') ? 409 : 500,
        statusMessage: 'Product save failed',
        message: getDatabaseErrorMessage(error)
      })
    }
  }

  if (event.method === 'DELETE') {
    await findProduct(id)

    const [deletedProduct] = await db.update(products)
      .set({
        isActive: false,
        updatedBy: SYSTEM_USER_ID,
        updatedAt: new Date()
      })
      .where(eq(products.id, id))
      .returning()

    if (!deletedProduct) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Product delete failed',
        message: 'Produk gagal dinonaktifkan'
      })
    }

    return {
      success: true,
      data: serializeProduct(deletedProduct)
    }
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method not allowed'
  })
})
