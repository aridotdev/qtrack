import { promises as fs } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ALLOWED_ATTACHMENT_MIME_TYPES, type AttachmentEntityType, type AllowedAttachmentMimeType } from '../database/schema/attachments'

/**
 * Service: Local file storage untuk attachment.
 *
 * Menyimpan file di bawah `public/uploads/<entityType>/<entityId>/<uuid>.<ext>`
 * sehingga dapat di-serve langsung oleh Nuxt sebagai static asset
 * (folder `public/` di-mount otomatis).
 *
 * Untuk production dengan object storage (S3/R2/Turso blob), replace
 * implementasi di file ini — interface publik (saveFile, deleteFile,
 * deleteAllForEntity) sengaja stabil.
 *
 * Konvensi penamaan file:
 *   <entityType>/<entityId>/<uuid>.<ext>
 *
 * Extension ditentukan dari mime type (bukan dari nama file asli)
 * untuk mencegah user meng-upload `evil.jpg` yang sebenarnya `.php`.
 */

const PUBLIC_DIR = 'public'
const UPLOAD_ROOT = 'uploads'

/** Batas ukuran file (5 MB) — sesuai spec §2.4.1. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024

const MIME_TO_EXT: Record<AllowedAttachmentMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

export function isAllowedMimeType(value: string): value is AllowedAttachmentMimeType {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(value)
}

export function getExtensionForMimeType(mime: AllowedAttachmentMimeType): string {
  return MIME_TO_EXT[mime]
}

/**
 * Resolve path absolut di mana file akan disimpan. Mengembalikan:
 * - `absolutePath` untuk dipakai `fs.writeFile`
 * - `relativePath` untuk disimpan di kolom `attachments.filePath`
 *   (relatif terhadap `public/`, tidak ada leading slash)
 */
export function resolveStoragePath(
  entityType: AttachmentEntityType,
  entityId: number,
  mime: AllowedAttachmentMimeType,
  originalName?: string
): { absolutePath: string, relativePath: string } {
  const ext = MIME_TO_EXT[mime] ?? extname(originalName ?? '').toLowerCase()
  const fileName = `${randomUUID()}${ext}`
  const relativePath = join(UPLOAD_ROOT, entityType, String(entityId), fileName)
  const absolutePath = join(process.cwd(), PUBLIC_DIR, relativePath)

  return { absolutePath, relativePath }
}

/**
 * Simpan sebuah file ke storage lokal.
 * - Validasi ukuran & mime type
 * - Buat direktori tujuan jika belum ada
 * - Return relative path (untuk disimpan di DB)
 */
export async function saveFile(
  file: { name: string, type: string, size: number, data: Buffer | Uint8Array | ArrayBuffer },
  entityType: AttachmentEntityType,
  entityId: number
): Promise<{ relativePath: string, fileName: string, mimeType: AllowedAttachmentMimeType, fileSize: number }> {
  if (!isAllowedMimeType(file.type)) {
    throw new StorageError(
      `Format file tidak didukung: ${file.type}. Gunakan JPEG, PNG, atau WebP.`,
      'UNSUPPORTED_MIME'
    )
  }
  if (file.size <= 0) {
    throw new StorageError('File kosong', 'EMPTY_FILE')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new StorageError(
      `Ukuran file ${file.name} melebihi batas ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`,
      'FILE_TOO_LARGE'
    )
  }

  const mime = file.type
  const { absolutePath, relativePath } = resolveStoragePath(entityType, entityId, mime, file.name)

  // Ensure directory exists
  const dir = join(process.cwd(), PUBLIC_DIR, UPLOAD_ROOT, entityType, String(entityId))
  await fs.mkdir(dir, { recursive: true })

  // Normalisasi buffer
  const buffer = Buffer.isBuffer(file.data)
    ? file.data
    : file.data instanceof ArrayBuffer
      ? Buffer.from(file.data)
      : Buffer.from(file.data)

  await fs.writeFile(absolutePath, buffer)

  return {
    relativePath,
    fileName: file.name,
    mimeType: mime,
    fileSize: file.size
  }
}

/**
 * Hapus satu file berdasarkan relative path. Tidak throw jika file sudah
 * tidak ada (idempotent) — best-effort cleanup.
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const safePath = normalizeRelativePath(relativePath)
  if (!safePath) return

  const absolutePath = join(process.cwd(), PUBLIC_DIR, safePath)

  try {
    await fs.unlink(absolutePath)
  } catch (error) {
    // ENOENT = file tidak ada → anggap sukses (idempotent).
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Log tapi jangan throw — caller butuh supaya DB row tetap terhapus
      // walau file fisik gagal di-unlink (file bisa di-cleanup manual).
      console.error(`[storage] gagal hapus file ${absolutePath}:`, error)
    }
  }
}

/**
 * Hapus semua file milik sebuah entity. Dipakai saat claim dihapus.
 * Best-effort: log error tapi tidak throw.
 */
export async function deleteAllForEntity(
  entityType: AttachmentEntityType,
  entityId: number
): Promise<void> {
  const dir = join(process.cwd(), PUBLIC_DIR, UPLOAD_ROOT, entityType, String(entityId))
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[storage] gagal hapus dir ${dir}:`, error)
    }
  }
}

/**
 * Sanitasi relativePath: hanya izinkan path di bawah UPLOAD_ROOT dan
 * tidak mengandung traversal (`..`).
 */
function normalizeRelativePath(relativePath: string): string | null {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return null
  // Strip leading slash
  let p = relativePath.replace(/^[/\\]+/, '')
  // Larang traversal absolut
  if (p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p)) return null
  // Larang `..` segments
  if (p.split(/[\\/]+/).some(seg => seg === '..' || seg === '.')) return null
  return p
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class StorageError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'StorageError'
  }
}
