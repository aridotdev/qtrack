import type { Claim, ClaimCreatePayload, ClaimStatusFilter, ClaimUpdatePayload, ClaimStatus, ClaimProgressLog, ClaimProgressLogCreatePayload, IssuePhoto, ClaimAttachment } from '~/types'

/**
 * Composable `useClaims()` — wrapper di atas `useFetch`/$fetch untuk
 * endpoint `/api/claims`.
 *
 * API endpoint `claims` (GET/POST/PUT/DELETE) sendiri diimplementasikan
 * pada task 1.4 (lihat `doc/task-plan-claim.md`). Composable ini sudah
 * siap dipakai dan otomatis ter-resolve ketika route handler tersedia.
 *
 * Pola penggunaan:
 *   const { items, status, refresh } = useClaims({
 *     search: 'CLM-2026',
 *     status: 'OPEN'
 *   })
 */

interface UseClaimsOptions {
  search?: Ref<string> | string
  status?: Ref<ClaimStatusFilter> | ClaimStatusFilter
  productId?: Ref<number | null> | number | null
  modelId?: Ref<number | null> | number | null
  defectId?: Ref<number | null> | number | null
  /** Auto-refetch saat dependency berubah. Default: true. */
  watch?: boolean
}

export interface ClaimsListResponse {
  success: boolean
  data: Claim[]
  message?: string
}

function unwrap<T>(value: T | Ref<T> | undefined, fallback: T): T {
  if (value === undefined || value === null) return fallback
  return unref(value as Ref<T>) as T
}

/**
 * Mengambil daftar claim dengan filter opsional.
 * Menggunakan `useFetch` agar mendapat reactive `status`, `error`, `refresh`.
 */
export function useClaims(options: UseClaimsOptions = {}) {
  const query = computed(() => {
    const params: Record<string, string | number> = {}
    const search = unwrap(options.search, '').trim()
    if (search) params.search = search
    const status = unwrap(options.status, 'all')
    if (status && status !== 'all') params.status = status
    const productId = unwrap(options.productId, null)
    if (productId !== null && productId !== undefined) params.productId = productId
    const modelId = unwrap(options.modelId, null)
    if (modelId !== null && modelId !== undefined) params.modelId = modelId
    const defectId = unwrap(options.defectId, null)
    if (defectId !== null && defectId !== undefined) params.defectId = defectId
    return params
  })

  return useFetch<ClaimsListResponse>('/api/claims', {
    query,
    lazy: true,
    watch: options.watch === false ? false : [query],
    default: () => ({ success: false, data: [] as Claim[] })
  })
}

/**
 * Mengambil satu claim by id (beserta relasi product/model/defect).
 */
export function useClaim(id: Ref<number | null> | number | null) {
  return useFetch<{ success: boolean, data: Claim | null }>(() => {
    const value = unwrap(id, null)
    return value ? `/api/claims/${value}` : ''
  }, {
    lazy: true,
    watch: [() => unwrap(id, null)],
    default: () => ({ success: false, data: null })
  })
}

/**
 * Ambil daftar progress log untuk satu claim (untuk section Progress Journal).
 */
export function useClaimProgressLogs(claimId: Ref<number | null> | number | null) {
  return useFetch<{ success: boolean, data: ClaimProgressLog[] }>(() => {
    const value = unwrap(claimId, null)
    return value ? `/api/claims/${value}/progress` : ''
  }, {
    lazy: true,
    watch: [() => unwrap(claimId, null)],
    default: () => ({ success: false, data: [] as ClaimProgressLog[] })
  })
}

/**
 * Ambil daftar Issue Photos untuk satu claim (entity_type='claim').
 * Digunakan oleh section Issue Photos di Detail Claim (Task 2.6).
 */
export function useClaimIssuePhotos(claimId: Ref<number | null> | number | null) {
  return useFetch<{ success: boolean, data: IssuePhoto[] }>(() => {
    const value = unwrap(claimId, null)
    return value ? `/api/claims/${value}/photos` : ''
  }, {
    lazy: true,
    watch: [() => unwrap(claimId, null)],
    default: () => ({ success: false, data: [] as IssuePhoto[] })
  })
}

// ============================================================================
// Mutators — menggunakan `$fetch` langsung karena `useFetch` untuk
// POST/PUT/DELETE kurang ergonomis (kita hanya ingin response tunggal,
// bukan reactive resource).
// ============================================================================

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

/** Buat claim baru. Throw error dengan message ramah user. */
export async function createClaim(payload: ClaimCreatePayload): Promise<Claim> {
  try {
    const res = await $fetch<{ success: boolean, data: Claim }>('/api/claims', {
      method: 'POST',
      body: payload
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal membuat claim'))
  }
}

/** Update field non-status claim. */
export async function updateClaim(payload: ClaimUpdatePayload): Promise<Claim> {
  try {
    const { id, ...rest } = payload
    const res = await $fetch<{ success: boolean, data: Claim }>(`/api/claims/${id}`, {
      method: 'PUT',
      body: rest
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal memperbarui claim'))
  }
}

/** Update status claim (state machine transition). */
export async function updateClaimStatus(claimId: number, status: ClaimStatus): Promise<Claim> {
  try {
    const res = await $fetch<{ success: boolean, data: Claim }>(`/api/claims/${claimId}/status`, {
      method: 'PATCH',
      body: { status }
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal mengubah status claim'))
  }
}

/** Hapus claim (soft/hard delete sesuai API). */
export async function deleteClaim(claimId: number): Promise<void> {
  try {
    await $fetch(`/api/claims/${claimId}`, { method: 'DELETE' })
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal menghapus claim'))
  }
}

/** Tambah progress log (jurnal progres). */
export async function createClaimProgressLog(payload: ClaimProgressLogCreatePayload): Promise<ClaimProgressLog> {
  try {
    const { claimId, ...rest } = payload
    const res = await $fetch<{ success: boolean, data: ClaimProgressLog }>(`/api/claims/${claimId}/progress`, {
      method: 'POST',
      body: rest
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal menambah jurnal progres'))
  }
}

/** Update progress log existing. Dipakai saat editor membuat draft untuk upload inline image. */
export async function updateClaimProgressLog(payload: {
  claimId: number
  progressId: number
  progressDate?: number
  notes?: string
}): Promise<ClaimProgressLog> {
  try {
    const { claimId, progressId, ...rest } = payload
    const res = await $fetch<{ success: boolean, data: ClaimProgressLog }>(`/api/claims/${claimId}/progress/${progressId}`, {
      method: 'PUT',
      body: rest
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal memperbarui jurnal progres'))
  }
}

/** Hapus progress log. Dipakai untuk cleanup draft jika user batal setelah upload gambar. */
export async function deleteClaimProgressLog(claimId: number, progressId: number): Promise<void> {
  try {
    await $fetch(`/api/claims/${claimId}/progress/${progressId}`, { method: 'DELETE' })
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal menghapus jurnal progres'))
  }
}

/** Upload gambar inline Rich Text Editor ke attachment entity `claim_progress`. */
export async function uploadClaimProgressImage(
  claimId: number,
  progressId: number,
  file: File
): Promise<ClaimAttachment> {
  try {
    const formData = new FormData()
    formData.append('image', file, file.name)
    const res = await $fetch<{ success: boolean, data: ClaimAttachment }>(`/api/claims/${claimId}/progress/${progressId}/attachments`, {
      method: 'POST',
      body: formData
    })
    return res.data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Gagal mengunggah gambar progress'))
  }
}
