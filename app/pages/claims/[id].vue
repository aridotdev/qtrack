<script setup lang="ts">
/**
 * Halaman Detail Claim (Task 2.5)
 *
 * Slicing section:
 * - Header ringkas: kode claim, status, produk/model/defect, metadata.
 * - Issue Photos: section dari IssuePhotosSection.vue (Task 2.6).
 * - Status Timeline: state machine transisi (Task 1.6 — endpoint sudah
 *   tersedia di backend).
 * - Progress Journal: list kronologis HTML notes dari `claim_progress_logs`
 *   (Task 1.7) + form tambah (form input via RichTextEditor dari Task 2.4).
 *
 * Kontrak backend (lihat server/api/claims/):
 *   GET    /api/claims/:id              → { success, data: Claim }
 *   GET    /api/claims/:id/photos       → { success, data: IssuePhoto[] }
 *   DELETE /api/claims/:id/photos/:id   → 204
 *   POST   /api/claims/:id/photos       → { success, data: IssuePhoto[] } (multipart)
 *   GET    /api/claims/:id/progress     → { success, data: ClaimProgressLog[] }
 *   POST   /api/claims/:id/progress     → { success, data: ClaimProgressLog }
 *   PATCH  /api/claims/:id/status       → { success, data: { oldStatus, newStatus, ... } }
 */

import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Claim, ClaimProgressLog, ClaimProgressLogCreatePayload, ClaimStatus, IssuePhoto } from '~/types'
import { CLAIM_STATUS_COLOR, CLAIM_STATUS_LABEL } from '~/types'
import { allowedNextStatuses } from '~/utils/claim-status'
import RichTextEditor from '~/components/claim/RichTextEditor.vue'
import IssuePhotosSection from '~/components/claim/IssuePhotosSection.vue'

definePageMeta({
  title: 'Detail Claim'
})

const route = useRoute()
const toast = useToast()
const router = useRouter()
const { user: currentUser } = useCurrentUser()

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UIcon = resolveComponent('UIcon')
const USelect = resolveComponent('USelect')

// ---------------------------------------------------------------------------
// Route param & data fetching
// ---------------------------------------------------------------------------

const claimId = computed<number | null>(() => {
  const raw = route.params.id
  const num = Array.isArray(raw) ? Number(raw[0]) : Number(raw)
  return Number.isInteger(num) && num > 0 ? num : null
})

const { data: claimResponse, status: claimStatus, refresh: refreshClaim } = useClaim(claimId)
const { data: progressResponse, status: progressStatus, refresh: refreshProgress } = useClaimProgressLogs(claimId)
const { data: photosResponse, status: photosStatus, refresh: refreshPhotos, error: photosError } = useClaimIssuePhotos(claimId)

const claim = computed<Claim | null>(() => claimResponse.value?.data ?? null)
const progressLogs = computed<ClaimProgressLog[]>(() => progressResponse.value?.data ?? [])
const photos = computed<IssuePhoto[]>(() => photosResponse.value?.data ?? [])

const canManageClaim = computed(() => {
  if (!claim.value || !currentUser.value) return false
  if (currentUser.value.role === 'admin') return true
  return currentUser.value.role === 'qrcc' && claim.value.createdBy === currentUser.value.id
})

const isLoading = computed(() =>
  claimStatus.value === 'pending'
  || claimStatus.value === 'idle'
  || progressStatus.value === 'pending'
  || progressStatus.value === 'idle'
  || photosStatus.value === 'pending'
  || photosStatus.value === 'idle'
)

/**
 * Photos API availability: gunakan `error` ref dari useFetch.
 * Jika status error 404 (mis. DB belum dimigrasi), anggap endpoint belum
 * tersedia dan tampilkan mode read-only.
 */
const photosApiAvailable = computed(() => {
  if (!photosError.value) return true
  const statusCode = (photosError.value as { statusCode?: number, status?: number }).statusCode
    ?? (photosError.value as { status?: number }).status
  return statusCode !== 404
})

// ---------------------------------------------------------------------------
// Head / meta
// ---------------------------------------------------------------------------

useHead({
  title: () => claim.value
    ? `${claim.value.claimCode} — Detail Claim`
    : 'Detail Claim — QC Market Quality Tracker'
})

// ---------------------------------------------------------------------------
// Progress log form (Task 2.4 integration: RichTextEditor)
// ---------------------------------------------------------------------------

const isProgressFormOpen = ref(false)
const isSavingProgress = ref(false)
const isCleaningProgressDraft = ref(false)
const draftProgressId = ref<number | null>(null)
const progressFormState = reactive({
  progressDate: new Date().toISOString().slice(0, 10),
  notes: ''
})

const progressSchema = z.object({
  progressDate: z
    .string()
    .min(1, 'Tanggal progres wajib diisi')
    .refine(v => !Number.isNaN(new Date(v).getTime()), {
      message: 'Tanggal progres tidak valid'
    }),
  notes: z
    .string()
    .trim()
    .min(1, 'Catatan progres wajib diisi')
    .max(20000, 'Catatan progres maksimal 20.000 karakter')
})

type ProgressForm = z.output<typeof progressSchema>

function resetProgressForm() {
  progressFormState.progressDate = new Date().toISOString().slice(0, 10)
  progressFormState.notes = ''
  draftProgressId.value = null
}

function openProgressForm() {
  if (!canManageClaim.value) return
  resetProgressForm()
  isProgressFormOpen.value = true
}

watch(isProgressFormOpen, async (open, wasOpen) => {
  if (open || !wasOpen || isSavingProgress.value) return
  await cleanupProgressDraft()
  resetProgressForm()
})

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  if (error instanceof Error) return error.message
  return fallback
}

async function cleanupProgressDraft() {
  if (!claimId.value || !draftProgressId.value) return
  const progressId = draftProgressId.value
  draftProgressId.value = null
  isCleaningProgressDraft.value = true
  try {
    await deleteClaimProgressLog(claimId.value, progressId)
    await refreshProgress()
    await refreshClaim()
  } catch (error) {
    toast.add({
      title: 'Draft jurnal belum terhapus',
      description: getErrorMessage(error, 'Coba hapus jurnal draft secara manual.'),
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
  } finally {
    isCleaningProgressDraft.value = false
  }
}

async function closeProgressForm() {
  isProgressFormOpen.value = false
  await cleanupProgressDraft()
  resetProgressForm()
}

async function ensureProgressDraft() {
  if (!claimId.value) {
    throw new Error('ID claim tidak valid')
  }
  if (draftProgressId.value) return draftProgressId.value

  const draft = await createClaimProgressLog({
    claimId: claimId.value,
    progressDate: new Date(progressFormState.progressDate).getTime(),
    notes: '<p></p>'
  })
  draftProgressId.value = draft.id
  await refreshProgress()
  await refreshClaim()
  return draft.id
}

async function uploadProgressImage(file: File) {
  if (!canManageClaim.value || !claimId.value) {
    throw new Error('Anda tidak punya akses mengunggah gambar pada claim ini')
  }
  const progressId = await ensureProgressDraft()
  return await uploadClaimProgressImage(claimId.value, progressId, file)
}

function onProgressImageUploadError(message: string) {
  toast.add({
    title: 'Gagal mengunggah gambar',
    description: message,
    color: 'error',
    icon: 'i-lucide-circle-alert'
  })
}

async function submitProgress(event: FormSubmitEvent<ProgressForm>) {
  if (!claimId.value) return
  isSavingProgress.value = true
  try {
    const payload: ClaimProgressLogCreatePayload = {
      claimId: claimId.value,
      progressDate: new Date(event.data.progressDate).getTime(),
      notes: event.data.notes
    }
    if (draftProgressId.value) {
      await updateClaimProgressLog({
        claimId: payload.claimId,
        progressId: draftProgressId.value,
        progressDate: payload.progressDate,
        notes: payload.notes
      })
      draftProgressId.value = null
    } else {
      await createClaimProgressLog(payload)
    }
    toast.add({
      title: 'Jurnal progres ditambahkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
    isProgressFormOpen.value = false
    resetProgressForm()
    await refreshProgress()
    await refreshClaim()
  } catch (error) {
    toast.add({
      title: 'Gagal menambah jurnal progres',
      description: getErrorMessage(error, 'Periksa data lalu coba lagi.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSavingProgress.value = false
  }
}

// ---------------------------------------------------------------------------
// Status transition (Task 1.6)
// ---------------------------------------------------------------------------

const isStatusUpdating = ref(false)
const nextStatus = ref<ClaimStatus | ''>('')

const allowedNext = computed<readonly ClaimStatus[]>(() => {
  if (!claim.value) return []
  const s = claim.value.status
  return allowedNextStatuses(s as ClaimStatus)
})

const statusSelectItems = computed(() => allowedNext.value.map(s => ({
  label: CLAIM_STATUS_LABEL[s],
  value: s
})))

async function changeStatus() {
  if (!claim.value || !nextStatus.value) return
  isStatusUpdating.value = true
  try {
    await updateClaimStatus(claim.value.id, nextStatus.value as ClaimStatus)
    toast.add({
      title: 'Status claim diperbarui',
      description: `${CLAIM_STATUS_LABEL[claim.value.status]} → ${CLAIM_STATUS_LABEL[nextStatus.value as ClaimStatus]}`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
    nextStatus.value = ''
    await refreshClaim()
  } catch (error) {
    toast.add({
      title: 'Gagal mengubah status',
      description: getErrorMessage(error, 'Status tidak berubah.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isStatusUpdating.value = false
  }
}

// ---------------------------------------------------------------------------
// Refresh helpers
// ---------------------------------------------------------------------------

async function onPhotosUpdated() {
  await Promise.all([refreshPhotos(), refreshClaim()])
}

function goBack() {
  router.push('/claims')
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long'
  }).format(new Date(value))
}

/** Sort progress logs ASC by progressDate (kronologis, sesuai spec §2.5). */
const sortedProgressLogs = computed(() =>
  [...progressLogs.value].sort((a, b) => {
    const aTime = new Date(a.progressDate).getTime()
    const bTime = new Date(b.progressDate).getTime()
    return aTime - bTime
  })
)
</script>

<template>
  <div class="mx-auto w-full max-w-7xl">
    <div v-if="claimId === null" class="py-12 text-center text-sm text-muted">
      ID claim tidak valid. Kembali ke
      <NuxtLink to="/claims" class="text-primary underline">daftar claim</NuxtLink>.
    </div>

    <div v-else-if="!isLoading && !claim" class="py-12 text-center text-sm text-muted">
      Claim tidak ditemukan.
    </div>

    <div v-else>
      <!-- Page title -->
      <div class="mb-6 flex items-center gap-3">
        <h1 class="text-2xl font-bold text-highlighted">
          Detail Claim
        </h1>
      </div>

      <!--
        Layout 2 kolom: Area utama (kiri) 2/3 + Sidebar sticky (kanan) 1/3.
        `lg:items-start` KRUSIAL: tanpa ini, default `align-items: stretch`
        dari flex membuat kolom kanan di-stretch setinggi kolom kiri,
        sehingga `position: sticky` tidak punya ruang untuk "menempel"
        karena tinggi child = tinggi container. Dengan `lg:items-start`,
        kolom kanan tetap setinggi kontennya sendiri, dan sticky
        bekerja normal saat user scroll.
        Pola persis mengikuti doc/slicing_ui_detail_claim.html.
      -->
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
        <!-- =====================================================
             AREA UTAMA (Kiri & Tengah)
             ===================================================== -->
        <div class="w-full space-y-6 lg:w-2/3">
          <!-- Kartu utama / Dokumen Claim -->
          <UCard
            v-if="claim"
            class="overflow-hidden"
            :ui="{ body: 'p-0 sm:p-0', header: 'p-0', footer: 'p-0' }"
          >
            <!-- Dokumen Header (status + identitas claim) -->
            <div class="border-b border-default p-6 md:p-8">
              <div class="mb-2 flex items-center gap-3">
                <UBadge
                  :color="CLAIM_STATUS_COLOR[claim.status]"
                  variant="subtle"
                  :label="CLAIM_STATUS_LABEL[claim.status]"
                />
                <span class="text-sm text-muted">
                  Dibuat {{ formatDate(claim.createdAt) }}
                  oleh <span class="font-medium text-highlighted">{{ claim.createdByName ?? claim.createdBy }}</span>
                </span>
              </div>

              <h2 class="mb-6 font-mono text-3xl font-bold text-highlighted">
                {{ claim.claimCode }}
              </h2>

              <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
                <div>
                  <p class="mb-0.5 text-muted">
                    Produk
                  </p>
                  <p class="font-semibold text-highlighted">
                    {{ claim.productName ?? '-' }}
                  </p>
                </div>
                <div>
                  <p class="mb-0.5 text-muted">
                    Model
                  </p>
                  <p class="font-semibold text-highlighted">
                    {{ claim.modelName ?? '-' }}
                  </p>
                  <p v-if="claim.modelSku" class="font-mono text-xs text-muted">
                    {{ claim.modelSku }}
                  </p>
                </div>
                <div>
                  <p class="mb-0.5 text-muted">
                    Defect
                  </p>
                  <p class="font-semibold text-highlighted">
                    {{ claim.defectName ?? '-' }}
                  </p>
                  <p v-if="claim.defectCode" class="font-mono text-xs text-muted">
                    {{ claim.defectCode }}
                  </p>
                </div>
                <div>
                  <p class="mb-0.5 text-muted">
                    Sumber
                  </p>
                  <p class="font-semibold text-highlighted">
                    {{ claim.source }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Dokumen Body (deskripsi + IssuePhotosSection) -->
            <div class="bg-elevated/30 p-6 md:p-8">
              <h4 class="mb-3 text-sm font-bold uppercase tracking-wide text-highlighted">
                Deskripsi Kendala
              </h4>
              <p class="mb-8 whitespace-pre-line text-sm leading-relaxed text-highlighted">
                {{ claim.description }}
              </p>

              <!-- Issue Photos (Task 2.6) — judul & tombol upload-nya sudah built-in -->
              <IssuePhotosSection
                :claim-id="claimId"
                :photos="photos"
                :can-manage="canManageClaim"
                :photos-api-available="photosApiAvailable"
                @updated="onPhotosUpdated"
              />
            </div>
          </UCard>

          <!-- Progress Journal -->
          <UCard
            :ui="{ body: 'p-0 sm:p-0', header: 'p-0', footer: 'p-0' }"
          >
            <div class="flex items-center justify-between border-b border-default px-5 py-4">
              <div>
                <h3 class="text-base font-semibold text-highlighted">
                  Progress Journal
                </h3>
                <p class="text-xs text-muted">
                  Catatan progres kronologis (diurut naik berdasarkan tanggal kegiatan).
                </p>
              </div>
              <UButton
                v-if="claim && canManageClaim"
                icon="i-lucide-plus"
                label="Tambah Jurnal"
                size="sm"
                variant="outline"
                @click="openProgressForm"
              />
            </div>

            <div class="p-5">
              <div
                v-if="sortedProgressLogs.length === 0"
                class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted"
              >
                <UIcon name="i-lucide-notebook-pen" class="mx-auto mb-2 size-6" />
                <p>Belum ada jurnal progres untuk claim ini.</p>
                <p v-if="canManageClaim" class="mt-1 text-xs">
                  Klik "Tambah Jurnal" untuk mulai mencatat progres.
                </p>
              </div>

              <ol v-else class="relative ml-3 space-y-6 border-l-2 border-default pl-6">
                <li
                  v-for="log in sortedProgressLogs"
                  :key="log.id"
                  class="relative"
                >
                  <span class="absolute -left-6.75 top-1 flex size-4 items-center justify-center rounded-full bg-elevated ring-4 ring-default">
                    <span class="size-2 rounded-full bg-primary" />
                  </span>
                  <article class="rounded-lg border border-default bg-elevated/40 p-4">
                    <header class="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div class="text-sm font-medium text-highlighted">
                        {{ formatDateOnly(log.progressDate) }}
                      </div>
                      <div class="flex items-center gap-1 text-xs text-muted">
                        <UIcon name="i-lucide-user" class="size-3.5" />
                        <span>{{ log.createdByName ?? log.createdBy }}</span>
                        <span>•</span>
                        <span>{{ formatDate(log.createdAt) }}</span>
                      </div>
                    </header>
                    <!--
                      Output WYSIWYG dirender di sini. Catatan: untuk hardening,
                      backend harus sanitize HTML sebelum disimpan (lihat Task 1.7
                      notes). Saat MVP, klien mempercayai output editor.
                    -->
                    <div
                      class="prose prose-sm max-w-none text-highlighted dark:prose-invert prose-headings:text-highlighted prose-a:text-primary prose-img:rounded-md"
                      v-html="log.notes"
                    />
                  </article>
                </li>
              </ol>
            </div>
          </UCard>
        </div>

        <!-- =====================================================
             AREA KANAN (Sidebar: Aksi Status & Timeline)
             Struktur flat sesuai pola slicing_ui_detail_claim.html:
             sticky + width pada satu elemen, tanpa wrapper tambahan.
             ===================================================== -->
        <div class="w-full space-y-6 lg:sticky lg:top-0 lg:w-1/3">
          <!-- Kartu Aksi Status (selalu tampil jika boleh manage; jika tidak,
               tampilkan versi read-only yang menampilkan status saat ini) -->
          <div
            class="rounded-xl border border-inverted bg-inverted p-5 text-inverted shadow-lg"
          >
            <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-dimmed">
              Perbarui Status
            </h3>

            <template v-if="canManageClaim && allowedNext.length > 0">
              <div class="space-y-3">
                <USelect
                  v-model="nextStatus"
                  :items="statusSelectItems"
                  value-key="value"
                  placeholder="Pilih Status Selanjutnya..."
                  class="w-full"
                  :ui="{ base: 'bg-elevated text-highlighted' }"
                  :disabled="isStatusUpdating"
                />
                <UButton
                  block
                  icon="i-lucide-check"
                  label="Terapkan Status"
                  color="neutral"
                  variant="solid"
                  :loading="isStatusUpdating"
                  :disabled="!nextStatus"
                  @click="changeStatus"
                />
              </div>
            </template>

            <template v-else-if="claim">
              <div class="space-y-2">
                <p class="text-xs text-dimmed">
                  Status saat ini
                </p>
                <UBadge
                  :color="CLAIM_STATUS_COLOR[claim.status]"
                  variant="solid"
                  :label="CLAIM_STATUS_LABEL[claim.status]"
                  size="md"
                />
                <p v-if="allowedNext.length === 0" class="text-xs text-dimmed">
                  Tidak ada transisi status berikutnya yang tersedia.
                </p>
                <p v-else class="text-xs text-dimmed">
                  Anda tidak memiliki akses untuk mengubah status claim ini.
                </p>
              </div>
            </template>
          </div>

          <!-- Kartu Timeline Vertikal (placeholder mengikuti pola slicing) -->
          <UCard>
            <h3 class="mb-5 text-base font-bold text-highlighted">
              Timeline Perjalanan
            </h3>
            <div class="relative ml-3 space-y-6 border-l-2 border-default pl-6">
              <!-- Titik status saat ini -->
              <div v-if="claim" class="relative">
                <span class="absolute -left-6.75 top-0 flex size-5 items-center justify-center rounded-full bg-default ring-2 ring-default">
                  <span
                    class="size-1.5 rounded-full"
                    :class="`bg-${CLAIM_STATUS_COLOR[claim.status]}-500`"
                  />
                </span>
                <div class="-mt-1">
                  <p
                    class="text-sm font-bold"
                    :class="`text-${CLAIM_STATUS_COLOR[claim.status]}-600 dark:text-${CLAIM_STATUS_COLOR[claim.status]}-400`"
                  >
                    {{ CLAIM_STATUS_LABEL[claim.status] }}
                  </p>
                  <p class="mt-0.5 text-xs text-muted">
                    Sedang berlangsung
                  </p>
                </div>
              </div>

              <!-- Created entry -->
              <div v-if="claim" class="relative">
                <span class="absolute -left-6.75 top-0 flex size-5 items-center justify-center rounded-full border-2 border-default bg-default">
                  <UIcon name="i-lucide-check" class="size-3 text-muted" />
                </span>
                <div class="-mt-1">
                  <p class="text-sm font-medium text-highlighted">
                    Claim Dibuat
                  </p>
                  <p class="mt-0.5 text-xs text-muted">
                    {{ formatDate(claim.createdAt) }}
                  </p>
                </div>
              </div>

              <!-- Catatan transisi log otomatis (placeholder) -->
              <div class="relative">
                <span class="absolute -left-6.75 top-0 flex size-5 items-center justify-center rounded-full border-2 border-dashed border-default bg-default">
                  <UIcon name="i-lucide-info" class="size-3 text-dimmed" />
                </span>
                <div class="-mt-1">
                  <p class="text-sm font-medium text-muted">
                    Riwayat transisi
                  </p>
                  <p class="mt-0.5 text-xs text-dimmed">
                    Visualisasi lengkap akan ditampilkan di Task UI berikutnya.
                  </p>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal tambah jurnal progres -->
  <UModal
    v-model:open="isProgressFormOpen"
    title="Tambah Jurnal Progres"
    description="Catat perkembangan terbaru untuk claim ini. Anda dapat memformat teks (bold, list, gambar)."
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="progress-form"
        :schema="progressSchema"
        :state="progressFormState"
        class="space-y-4"
        @submit="submitProgress"
      >
        <UFormField name="progressDate" label="Tanggal Progres" required>
          <UInput
            v-model="progressFormState.progressDate"
            type="date"
            class="w-full sm:max-w-xs"
          />
        </UFormField>

        <UFormField name="notes" label="Catatan" required>
          <RichTextEditor
            v-model="progressFormState.notes"
            placeholder="Tulis catatan progres... (mendukung bold, list, dan upload gambar)"
            :upload-image="uploadProgressImage"
            @image-upload-error="onProgressImageUploadError"
          />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        :disabled="isSavingProgress || isCleaningProgressDraft"
        @click="closeProgressForm"
      />
      <UButton
        type="submit"
        form="progress-form"
        label="Simpan Jurnal"
        icon="i-lucide-save"
        :loading="isSavingProgress"
        :disabled="isCleaningProgressDraft"
      />
    </template>
  </UModal>
</template>
