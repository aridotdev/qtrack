import { and, eq, like, sql } from 'drizzle-orm'
import { db } from '../database'
import { claims } from '../database/schema'

/**
 * Service: Claim Code Generator
 *
 * Meng-generate `claimCode` otomatis untuk claim baru dengan format:
 *   CLM-YYYY-NNN
 *
 * - `YYYY` = tahun 4 digit (Gregorian) dari waktu pembuatan claim.
 * - `NNN`  = nomor urut 3-digit (zero-padded) reset tiap tahun,
 *            berdasarkan jumlah claim yang sudah ada di tahun yang sama
 *            + 1.
 *
 * Catatan desain:
 * - Implementasi menggunakan SELECT COUNT + INSERT, sehingga di bawah
 *   concurrency tinggi ada kemungkinan race condition (dua claim mendapat
 *   nomor urut yang sama). Pada MVP SQLite dengan traffic rendah hal ini
 *   acceptable; untuk hardening lebih lanjut gunakan transaction + retry
 *   atau kolom sequence (lihat TODO di bawah).
 * - `claimCode` UNIQUE di schema → DB akan reject duplikat sebagai safety net.
 *
 * TODO (post-MVP): tambahkan retry loop dengan bounded attempts jika
 * drizle insert melempar UNIQUE constraint error.
 */

const CODE_PREFIX = 'CLM'
const SEQ_PADDING = 3 // CLM-YYYY-001
const MAX_SEQ = 999 // 3 digit max; setelahnya tetap akan di-pad (jadi 1000, dst)

export interface GenerateClaimCodeOptions {
  /** Optional override tanggal pembuatan (untuk backfill/seeding). Default: now. */
  now?: Date
}

export interface GeneratedClaimCode {
  code: string
  year: number
  sequence: number
}

/**
 * Menghitung nomor urut berikutnya untuk tahun tertentu dengan cara
 * menghitung jumlah claim yang sudah ada di tahun tsb, lalu +1.
 *
 * Query menggunakan LIKE `CLM-YYYY-%` karena `claimCode` UNIQUE dan terformat.
 */
async function nextSequenceForYear(year: number): Promise<number> {
  const prefix = `${CODE_PREFIX}-${year}-`
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(claims)
    .where(like(claims.claimCode, `${prefix}%`))

  const current = Number(rows[0]?.count ?? 0)
  return current + 1
}

/**
 * Generate `claimCode` berikutnya. Tidak menulis ke DB; hanya menghitung.
 * Untuk membuat claim, gunakan `generateUniqueClaimCode` yang retry bila
 * terjadi UNIQUE collision (mis. pada race condition).
 */
export async function generateClaimCode(
  opts: GenerateClaimCodeOptions = {}
): Promise<GeneratedClaimCode> {
  const now = opts.now ?? new Date()
  const year = now.getUTCFullYear()
  const sequence = await nextSequenceForYear(year)
  const code = formatClaimCode(year, sequence)

  return { code, year, sequence }
}

/**
 * Generate `claimCode` yang dijamin unik dengan retry.
 *
 * Dipakai saat insert claim baru (Task 1.4 ke depan). Melakukan beberapa
 * percobaan jika menemukan UNIQUE collision (race condition).
 */
export async function generateUniqueClaimCode(
  opts: GenerateClaimCodeOptions = {},
  maxAttempts = 5
): Promise<GeneratedClaimCode> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = await generateClaimCode(opts)

    // Double-check: klaim dengan kode ini benar-benar belum ada.
    // (Pada umumnya langkah `nextSequenceForYear` sudah cukup karena
    // menggunakan COUNT, tapi cek ulang untuk safety.)
    const existing = await db
      .select({ id: claims.id })
      .from(claims)
      .where(and(eq(claims.claimCode, candidate.code)))
      .limit(1)

    if (existing.length === 0) {
      return candidate
    }

    // Jika ternyata sudah ada (race), loop lagi → sequence naik.
    lastError = new Error(`Collision on ${candidate.code} (attempt ${attempt + 1})`)
  }

  throw new Error(
    `Gagal generate unique claim code setelah ${maxAttempts} percobaan: ` +
    (lastError instanceof Error ? lastError.message : String(lastError))
  )
}

/**
 * Format tahun + sequence menjadi string `CLM-YYYY-NNN`.
 * Sequence > 999 tetap di-pad minimal 3 digit (jadi 1000, dst) — tidak
 * truncate ke 3 digit supaya tidak terjadi duplikat.
 */
export function formatClaimCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year: ${year}`)
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Invalid sequence: ${sequence}`)
  }
  const seqStr = sequence.toString().padStart(SEQ_PADDING, '0')
  return `${CODE_PREFIX}-${year}-${seqStr}`
}

/**
 * Validasi format `claimCode` (tanpa menyentuh DB).
 * Berguna untuk Zod refinement di API layer (Task 1.4).
 */
const CLAIM_CODE_REGEX = /^CLM-\d{4}-\d{3,}$/

export function isValidClaimCodeFormat(code: string): boolean {
  return typeof code === 'string' && CLAIM_CODE_REGEX.test(code)
}

/** Konstanta untuk consumption luar (UI, test). */
export const CLAIM_CODE_FORMAT = {
  prefix: CODE_PREFIX,
  yearDigits: 4,
  sequenceMinDigits: SEQ_PADDING,
  maxSequenceAtBasePadding: MAX_SEQ,
  example: 'CLM-2026-001'
} as const

// Re-export supaya service caller tidak perlu import sql/eq/and/like manual.
export { and, eq, like, sql }
