<script setup lang="ts">
/**
 * IssuePhotosSection (Task 2.6)
 *
 * Section "Issue Photos" di halaman Detail Claim. Menampilkan foto
 * sebagai thumbnail grid + tombol Add/Remove. Klik thumbnail membuka
 * `PhotoLightbox` (Task 2.7).
 *
 * Catatan:
 * - Endpoint `POST /api/claims/:id/photos` dan
 *   `DELETE /api/claims/:id/photos/:photoId` diimplementasikan pada
 *   Task 1.8 (belum tersedia). Komponen ini defensif: ketika endpoint
 *   belum ada, mode Add/Remove tidak menampilkan tombol sama sekali
 *   (read-only) sehingga tidak terjadi 404 di console.
 * - `IssuePhotoUploader` (Task 2.3) dipakai kembali untuk picking foto
 *   dari klien dengan validasi yang sama persis dengan create.
 * - Hak akses Add/Remove dikontrol via `canManage` prop; default `false`
 *   sampai Task 3.2 (Better Auth) selesai diintegrasikan.
 */

import type { IssuePhoto } from '~/types'
import IssuePhotoUploader, { type IssuePhotoDraft } from './IssuePhotoUploader.vue'
import PhotoLightbox from './PhotoLightbox.vue'

const props = withDefaults(defineProps<{
  claimId: number | null
  photos: IssuePhoto[]
  /** Boleh menambah/menghapus foto. Default: false (read-only). */
  canManage?: boolean
  /** Endpoint availability check — ketika `false` tombol tidak ditampilkan. */
  photosApiAvailable?: boolean
  /** Batas jumlah foto per claim. */
  maxPhotos?: number
}>(), {
  canManage: false,
  photosApiAvailable: false,
  maxPhotos: 5
})

const emit = defineEmits<{
  (e: 'updated'): void
}>()

const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()

const sortedPhotos = computed(() =>
  [...props.photos].sort((a, b) => {
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0
    return aTime - bTime // ASC: kronologis upload
  })
)

const remainingSlots = computed(() => props.maxPhotos - sortedPhotos.value.length)
const isMaxReached = computed(() => sortedPhotos.value.length >= props.maxPhotos)
const canAddMore = computed(() =>
  props.canManage
  && props.photosApiAvailable
  && props.claimId !== null
  && !isMaxReached.value
)
const canRemove = computed(() => props.canManage && props.photosApiAvailable)

// ---------------------------------------------------------------------------
// Lightbox state
// ---------------------------------------------------------------------------

const isLightboxOpen = ref(false)
const lightboxIndex = ref(0)

function openLightbox(index: number) {
  lightboxIndex.value = index
  isLightboxOpen.value = true
}

// ---------------------------------------------------------------------------
// Add photos flow
// ---------------------------------------------------------------------------

const isPickerOpen = ref(false)
const newDrafts = ref<IssuePhotoDraft[]>([])
const isUploading = ref(false)

function openPicker() {
  if (!canAddMore.value) return
  newDrafts.value = []
  isPickerOpen.value = true
}

function closePicker() {
  isPickerOpen.value = false
  // Bersihkan object URL agar tidak bocor.
  newDrafts.value.forEach((d) => {
    try { URL.revokeObjectURL(d.previewUrl) } catch { /* noop */ }
  })
  newDrafts.value = []
}

function onPickerError(message: string) {
  toast.add({
    title: 'Foto tidak dapat ditambahkan',
    description: message,
    color: 'warning',
    icon: 'i-lucide-triangle-alert'
  })
}

async function uploadNewPhotos() {
  if (!props.claimId || newDrafts.value.length === 0) return
  isUploading.value = true
  try {
    const formData = new FormData()
    newDrafts.value.forEach((draft) => {
      formData.append('photos', draft.file, draft.file.name)
    })
    await $fetch(`/api/claims/${props.claimId}/photos`, {
      method: 'POST',
      body: formData
    })
    toast.add({
      title: 'Foto berhasil diunggah',
      description: `${newDrafts.value.length} foto ditambahkan ke Issue Photos.`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
    closePicker()
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Gagal mengunggah foto',
      description: getErrorMessage(error, 'Coba lagi beberapa saat.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isUploading.value = false
  }
}

// ---------------------------------------------------------------------------
// Remove photo flow
// ---------------------------------------------------------------------------

const photoToRemove = ref<IssuePhoto | null>(null)
const isRemoving = ref(false)
const isRemoveOpen = computed({
  get: () => photoToRemove.value !== null,
  set: (open) => {
    if (!open) photoToRemove.value = null
  }
})

function confirmRemove(photo: IssuePhoto) {
  photoToRemove.value = photo
}

function cancelRemove() {
  photoToRemove.value = null
}

async function removePhoto() {
  const photo = photoToRemove.value
  if (!photo || !props.claimId) return
  isRemoving.value = true
  try {
    await $fetch(`/api/claims/${props.claimId}/photos/${photo.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Foto dihapus',
      description: `${photo.fileName} telah dihapus dari Issue Photos.`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
    photoToRemove.value = null
    emit('updated')
  } catch (error) {
    toast.add({
      title: 'Gagal menghapus foto',
      description: getErrorMessage(error, 'Foto belum dihapus.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isRemoving.value = false
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getRowItems(photo: IssuePhoto) {
  return [
    [{
      label: 'Lihat',
      icon: 'i-lucide-eye',
      onSelect: () => {
        const idx = sortedPhotos.value.findIndex(p => p.id === photo.id)
        if (idx >= 0) openLightbox(idx)
      }
    }, {
      label: 'Hapus',
      icon: 'i-lucide-trash',
      color: 'error' as const,
      disabled: !canRemove.value,
      onSelect: () => confirmRemove(photo)
    }]
  ]
}
</script>

<template>
  <section class="space-y-3">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-highlighted">
          Issue Photos
        </h3>
        <p class="text-xs text-muted">
          Dokumentasi visual defect/issue. Maks {{ maxPhotos }} foto.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UBadge
          :color="isMaxReached ? 'warning' : 'neutral'"
          variant="subtle"
          :label="`${sortedPhotos.length} / ${maxPhotos}`"
        />
        <UButton
          v-if="canAddMore"
          icon="i-lucide-plus"
          label="Tambah Foto"
          size="sm"
          :disabled="!canAddMore"
          @click="openPicker"
        />
      </div>
    </header>

    <div
      v-if="sortedPhotos.length > 0"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
    >
      <div
        v-for="(photo, index) in sortedPhotos"
        :key="photo.id"
        class="group relative aspect-square overflow-hidden rounded-md border border-default bg-elevated"
      >
        <button
          type="button"
          class="block h-full w-full cursor-zoom-in"
          :aria-label="`Buka foto ${photo.fileName}`"
          @click="openLightbox(index)"
        >
          <img
            :src="photo.url"
            :alt="photo.fileName"
            class="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          >
        </button>

        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[10px] text-white">
          <p class="truncate font-medium">
            {{ photo.fileName }}
          </p>
          <p class="text-white/70">
            {{ formatBytes(photo.fileSize) }} • {{ formatDate(photo.uploadedAt) }}
          </p>
        </div>

        <div
          v-if="canRemove"
          class="absolute right-1 top-1"
        >
          <UDropdownMenu
            :items="getRowItems(photo)"
            :content="{ align: 'end' }"
          >
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="solid"
              size="xs"
              aria-label="Aksi foto"
            />
          </UDropdownMenu>
        </div>
      </div>
    </div>

    <div
      v-else
      class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      <UIcon name="i-lucide-image-off" class="mx-auto mb-2 size-6 text-muted" />
      <p>Belum ada Issue Photos untuk claim ini.</p>
      <p v-if="canAddMore" class="mt-1 text-xs">
        Klik tombol "Tambah Foto" untuk mengunggah dokumentasi visual defect.
      </p>
    </div>

    <!-- Lightbox viewer (Task 2.7) -->
    <PhotoLightbox
      v-model:open="isLightboxOpen"
      v-model:current-index="lightboxIndex"
      :photos="sortedPhotos"
    />

    <!-- Modal tambah foto -->
    <UModal
      v-model:open="isPickerOpen"
      title="Tambah Issue Photos"
      description="Pilih foto dokumentasi defect/issue. Maks 5 foto per claim, masing-masing maks 5 MB."
      :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end' }"
    >
      <template #body>
        <IssuePhotoUploader
          v-model="newDrafts"
          :max-files="remainingSlots > 0 ? remainingSlots : maxPhotos"
          :max-file-size="5 * 1024 * 1024"
          @error="onPickerError"
        />
      </template>
      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isUploading"
          @click="() => { close(); closePicker() }"
        />
        <UButton
          label="Unggah"
          icon="i-lucide-upload"
          :loading="isUploading"
          :disabled="newDrafts.length === 0"
          @click="uploadNewPhotos"
        />
      </template>
    </UModal>

    <!-- Konfirmasi hapus foto -->
    <UModal
      v-model:open="isRemoveOpen"
      title="Hapus Issue Photo"
      :description="`Foto ${photoToRemove?.fileName ?? ''} akan dihapus permanen dari Issue Photos.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isRemoving"
          @click="() => { close(); cancelRemove() }"
        />
        <UButton
          label="Hapus"
          color="error"
          icon="i-lucide-trash"
          :loading="isRemoving"
          @click="removePhoto"
        />
      </template>
    </UModal>
  </section>
</template>
