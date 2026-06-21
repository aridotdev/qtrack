import { eq, and } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '../database'
import { claims, defects } from '../database/schema'

/**
 * Helper: Validasi RESTRICT master data sebelum soft-delete.
 *
 * Background (Task 3.3 — doc/task-plan-claim.md):
 * Tabel `claims` memiliki FK dengan `ON DELETE RESTRICT` ke `products`,
 * `product_models`, dan `defects`. Artinya jika master data dipakai di
 * claim manapun, DB akan menolak DELETE. Endpoint master kita tidak
 * melakukan hard delete — hanya soft delete via `isActive=false` —
 * sehingga FK RESTRICT tidak pernah trigger dari sisi DB. Karenanya,
 * guard eksplisit diperlukan di level aplikasi agar user mendapat
 * pesan error yang jelas ("sedang dipakai di claim") alih-alih
 * sukses soft-delete yang akan membuat claim refer ke master tidak aktif.
 *
 * Untuk `defectCategories`, FK ke `defects` juga RESTRICT, dan kategori
 * hanya boleh di-nonaktifkan jika tidak ada defect aktif di dalamnya.
 *
 * Pola: dipanggil sebelum `db.update(... isActive=false)` di masing-masing
 * endpoint master. Throw `createError` 409 + pesan Indonesia spesifik.
 */

export interface MasterGuardOptions {
  productId?: number
  modelId?: number
  defectId?: number
  /**
   * Untuk kategori defect — cek apakah masih ada defect aktif di
   * kategori ini (defect.isActive=true). Defect non-aktif tidak
   * menghalangi kategori untuk dinonaktifkan.
   */
  categoryId?: number
}

/**
 * Throw 409 jika salah satu master data yang dicek sedang dipakai.
 * Aman dipanggil dengan opsi kosong (no-op).
 */
export async function assertNotUsedInClaims(opts: MasterGuardOptions): Promise<void> {
  if (opts.productId !== undefined) {
    const [row] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.productId, opts.productId))
      .limit(1)
    if (row) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Product in use',
        message: 'Produk tidak bisa dinonaktifkan karena sudah dipakai di claim'
      })
    }
  }

  if (opts.modelId !== undefined) {
    const [row] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.modelId, opts.modelId))
      .limit(1)
    if (row) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Model in use',
        message: 'Model tidak bisa dinonaktifkan karena sudah dipakai di claim'
      })
    }
  }

  if (opts.defectId !== undefined) {
    const [row] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.defectId, opts.defectId))
      .limit(1)
    if (row) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Defect in use',
        message: 'Defect tidak bisa dinonaktifkan karena sudah dipakai di claim'
      })
    }
  }

  if (opts.categoryId !== undefined) {
    // Kategori dicegah dinonaktifkan hanya jika ada defect AKTIF di dalamnya.
    // Defect non-aktif boleh tetap ada; kategori tetap bisa di-soft-delete.
    const [row] = await db
      .select({ id: defects.id })
      .from(defects)
      .where(and(
        eq(defects.categoryId, opts.categoryId),
        eq(defects.isActive, true)
      ))
      .limit(1)
    if (row) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Category in use',
        message: 'Kategori defect tidak bisa dinonaktifkan karena masih ada defect aktif di dalamnya'
      })
    }
  }
}
