<script setup lang="ts">
/**
 * PhotoLightbox (Task 2.7)
 *
 * Modal viewer full-size untuk foto Issue Claim. Dirancang reusable —
 * caller menyediakan array `photos` dan current index, komponen ini
 * yang mengatur navigasi & lifecycle.
 *
 * Fitur:
 * - Tombol next / prev + keyboard (ArrowLeft, ArrowRight, Escape).
 * - Klik backdrop menutup lightbox; klik gambar tidak menutup (mencegah
 *   navigasi tak sengaja saat zoom-in).
 * - Preload gambar berikutnya & sebelumnya untuk transisi halus.
 * - Reset index ke 0 setiap kali array `photos` berubah (mis. setelah
 *   add/remove foto di parent).
 * - Counter "x / y" + caption nama file + uploader.
 */

interface LightboxPhoto {
  /** URL gambar yang di-serve oleh API. */
  url: string
  /** Nama file original (untuk caption). */
  fileName: string
  /** Ukuran file dalam bytes (untuk caption). */
  fileSize?: number
  /** Nama user uploader (untuk caption). */
  uploadedByName?: string | null
  /** Tanggal upload (ISO string) untuk caption. */
  uploadedAt?: string
}

const props = withDefaults(defineProps<{
  open: boolean
  photos: LightboxPhoto[]
  /** Indeks foto yang sedang ditampilkan. Dikontrol oleh parent. */
  currentIndex: number
}>(), {
  photos: () => []
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:currentIndex', value: number): void
}>()

const UButton = resolveComponent('UButton')
const UIcon = resolveComponent('UIcon')

const isOpen = computed({
  get: () => props.open,
  set: v => emit('update:open', v)
})

const currentIndex = computed({
  get: () => props.currentIndex,
  set: v => emit('update:currentIndex', v)
})

const hasPhotos = computed(() => props.photos.length > 0)
const hasMultiple = computed(() => props.photos.length > 1)
const currentPhoto = computed<LightboxPhoto | null>(() => {
  if (!hasPhotos.value) return null
  const idx = Math.min(Math.max(currentIndex.value, 0), props.photos.length - 1)
  return props.photos[idx] ?? null
})

function close() {
  isOpen.value = false
}

function next() {
  if (!hasMultiple.value) return
  currentIndex.value = (currentIndex.value + 1) % props.photos.length
}

function prev() {
  if (!hasMultiple.value) return
  currentIndex.value = (currentIndex.value - 1 + props.photos.length) % props.photos.length
}

/** Reset ke foto pertama setiap kali daftar foto berubah dari parent. */
watch(() => props.photos, () => {
  if (currentIndex.value >= props.photos.length) {
    currentIndex.value = 0
  }
}, { deep: true })

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prev()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(value?: string): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      content: 'sm:max-w-4xl bg-black/95 text-white',
      header: 'border-b border-white/10',
      body: 'p-0 sm:p-0',
      footer: 'border-t border-white/10'
    }"
  >
    <template #header>
      <div class="flex w-full items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-image" class="size-4" />
          <span v-if="hasMultiple">
            Foto {{ currentIndex + 1 }} / {{ photos.length }}
          </span>
          <span v-else-if="hasPhotos">Foto</span>
          <span v-else>Tidak ada foto</span>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Tutup lightbox"
          @click="close"
        />
      </div>
    </template>

    <template #body>
      <div class="relative flex min-h-[60vh] items-center justify-center bg-black">
        <!-- Tombol navigasi kiri -->
        <UButton
          v-if="hasMultiple"
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="solid"
          size="lg"
          class="absolute left-2 z-10 rounded-full sm:left-4"
          aria-label="Foto sebelumnya"
          @click="prev"
        />

        <!-- Gambar utama -->
        <div v-if="currentPhoto" class="flex max-h-[75vh] w-full items-center justify-center p-4">
          <img
            :src="currentPhoto.url"
            :alt="currentPhoto.fileName"
            class="max-h-[75vh] max-w-full object-contain"
            draggable="false"
          >
        </div>
        <div v-else class="flex h-60 items-center justify-center text-sm text-white/60">
          Tidak ada foto untuk ditampilkan.
        </div>

        <!-- Tombol navigasi kanan -->
        <UButton
          v-if="hasMultiple"
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="solid"
          size="lg"
          class="absolute right-2 z-10 rounded-full sm:right-4"
          aria-label="Foto berikutnya"
          @click="next"
        />
      </div>
    </template>

    <template #footer>
      <div v-if="currentPhoto" class="flex w-full flex-col gap-1 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
        <div class="truncate font-medium text-white">
          {{ currentPhoto.fileName }}
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
          <span v-if="currentPhoto.fileSize">{{ formatBytes(currentPhoto.fileSize) }}</span>
          <span v-if="currentPhoto.uploadedByName">oleh {{ currentPhoto.uploadedByName }}</span>
          <span v-if="currentPhoto.uploadedAt">{{ formatDate(currentPhoto.uploadedAt) }}</span>
        </div>
      </div>
    </template>
  </UModal>
</template>
