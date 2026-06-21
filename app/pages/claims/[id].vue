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
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
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

const statusSelectItems = computed(() => allowedNext.value.map((s) => ({
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

async function refreshAll() {
  await Promise.all([refreshClaim(), refreshProgress(), refreshPhotos()])
}

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
  <UDashboardPanel id="claim-detail">
    <template #header>
      <UDashboardNavbar :title="claim?.claimCode ?? 'Detail Claim'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            label="Kembali"
            @click="goBack"
          />
          <UButton
            v-if="claim && canManageClaim"
            icon="i-lucide-notebook-pen"
            label="Tambah Jurnal"
            @click="openProgressForm"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="claimId === null" class="py-12 text-center text-sm text-muted">
        ID claim tidak valid. Kembali ke
        <NuxtLink to="/claims" class="text-primary underline">daftar claim</NuxtLink>.
      </div>

      <div v-else-if="!isLoading && !claim" class="py-12 text-center text-sm text-muted">
        Claim tidak ditemukan.
      </div>

      <div v-else class="flex flex-col gap-6">
        <!-- Header ringkas -->
        <section
          v-if="claim"
          class="rounded-lg border border-default bg-elevated/30 p-4 sm:p-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h2 class="font-mono text-lg font-semibold text-highlighted">
                  {{ claim.claimCode }}
                </h2>
                <UBadge
                  :color="CLAIM_STATUS_COLOR[claim.status]"
                  variant="subtle"
                  :label="CLAIM_STATUS_LABEL[claim.status]"
                />
              </div>
              <p class="text-sm text-muted">
                Dibuat {{ formatDate(claim.createdAt) }}
                oleh <span class="font-medium text-highlighted">{{ claim.createdByName ?? claim.createdBy }}</span>
              </p>
            </div>

            <!-- Status transition control (Task 1.6) -->
            <div v-if="canManageClaim && allowedNext.length > 0" class="flex items-center gap-2">
              <USelect
                v-model="nextStatus"
                :items="statusSelectItems"
                value-key="value"
                placeholder="Ubah status..."
                class="min-w-44"
                :disabled="isStatusUpdating"
              />
              <UButton
                icon="i-lucide-check"
                label="Terapkan"
                size="sm"
                :loading="isStatusUpdating"
                :disabled="!nextStatus"
                @click="changeStatus"
              />
            </div>
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-muted">Produk</p>
              <p class="text-sm font-medium text-highlighted">{{ claim.productName ?? '-' }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-wide text-muted">Model</p>
              <p class="text-sm font-medium text-highlighted">{{ claim.modelName ?? '-' }}</p>
              <p v-if="claim.modelSku" class="font-mono text-xs text-muted">{{ claim.modelSku }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-wide text-muted">Defect</p>
              <p class="text-sm font-medium text-highlighted">{{ claim.defectName ?? '-' }}</p>
              <p v-if="claim.defectCode" class="font-mono text-xs text-muted">{{ claim.defectCode }}</p>
            </div>
            <div class="sm:col-span-3">
              <p class="text-xs uppercase tracking-wide text-muted">Sumber</p>
              <p class="text-sm text-highlighted">{{ claim.source }}</p>
            </div>
            <div class="sm:col-span-3">
              <p class="text-xs uppercase tracking-wide text-muted">Deskripsi</p>
              <p class="whitespace-pre-line text-sm text-highlighted">{{ claim.description }}</p>
            </div>
          </div>
        </section>

        <!-- Issue Photos (Task 2.6) -->
        <IssuePhotosSection
          :claim-id="claimId"
          :photos="photos"
          :can-manage="canManageClaim"
          :photos-api-available="photosApiAvailable"
          @updated="onPhotosUpdated"
        />

        <!-- Status Timeline placeholder (riwayat transisi) -->
        <section class="rounded-lg border border-default bg-elevated/30 p-4 sm:p-6">
          <header class="mb-3 flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-highlighted">Status Timeline</h3>
              <p class="text-xs text-muted">Riwayat transisi status klaim.</p>
            </div>
            <UIcon name="i-lucide-clock" class="size-4 text-muted" />
          </header>
          <div class="rounded-md border border-dashed border-default p-4 text-center text-sm text-muted">
            <UIcon name="i-lucide-info" class="mx-auto mb-1 size-5" />
            <p>Visualisasi timeline transisi status akan ditampilkan di Task UI berikutnya.</p>
            <p class="mt-1 text-xs">Data log sudah tercatat otomatis di backend saat status berubah.</p>
          </div>
        </section>

        <!-- Progress Journal -->
        <section class="rounded-lg border border-default bg-elevated/30 p-4 sm:p-6">
          <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-highlighted">Progress Journal</h3>
              <p class="text-xs text-muted">
                Catatan progres kronologis (diurut naik berdasarkan tanggal kegiatan).
              </p>
            </div>
            <UButton
              v-if="claim && canManageClaim"
              icon="i-lucide-plus"
              label="Tambah Jurnal"
              size="sm"
              @click="openProgressForm"
            />
          </header>

          <div v-if="sortedProgressLogs.length === 0" class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted">
            <UIcon name="i-lucide-notebook-pen" class="mx-auto mb-2 size-6" />
            <p>Belum ada jurnal progres untuk claim ini.</p>
            <p class="mt-1 text-xs">Klik "Tambah Jurnal" untuk mulai mencatat progres.</p>
          </div>

          <ol v-else class="relative space-y-4 border-l border-default pl-5">
            <li
              v-for="log in sortedProgressLogs"
              :key="log.id"
              class="relative"
            >
              <span class="absolute -left-7 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-elevated/30">
                <UIcon name="i-lucide-dot" class="size-3" />
              </span>
              <article class="rounded-md border border-default bg-default p-4">
                <header class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-medium text-highlighted">
                    {{ formatDateOnly(log.progressDate) }}
                  </div>
                  <div class="text-xs text-muted">
                    {{ log.createdByName ?? log.createdBy }} • {{ formatDate(log.createdAt) }}
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
        </section>
      </div>
    </template>

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
  </UDashboardPanel>
</template>
