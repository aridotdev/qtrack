<script setup lang="ts">
/**
 * IssuePhotoUploader
 *
 * Komponen upload multi-file untuk Issue Photos (foto dokumentasi visual
 * defect/issue) saat membuat claim baru atau menambah foto ke claim
 * yang sudah ada.
 *
 * Spesifikasi (lihat doc/backend.md §12 + doc/task-plan-claim.md §2.4.1):
 * - Maks 5 foto per claim
 * - Format: image/jpeg, image/png, image/webp
 * - Ukuran: maks 5 MB per foto (5242880 bytes)
 * - Wajib minimal 1 (disarankan, tidak hard-required) → karena untuk create
 *   ini opsional, kita tidak reject submit jika kosong; cukup tampilkan hint.
 * - Tampil sebagai thumbnail grid + tombol remove per item
 *
 * Parent (form create/edit) yang bertanggung jawab melakukan upload final
 * via API. Komponen ini hanya mengelola state file di sisi klien.
 */

import { ref, computed, watch } from 'vue'

export interface IssuePhotoDraft {
  /** ID sementara untuk key list. Di-reset saat parent submit. */
  uid: string
  file: File
  /** Object URL untuk preview. */
  previewUrl: string
  /** Ukuran dalam bytes (untuk display). */
  size: number
}

const props = withDefaults(defineProps<{
  modelValue: IssuePhotoDraft[]
  maxFiles?: number
  maxFileSize?: number
  disabled?: boolean
}>(), {
  maxFiles: 5,
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: IssuePhotoDraft[]): void
  (e: 'error', message: string): void
}>()

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const inputRef = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const photos = computed<IssuePhotoDraft[]>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const remainingSlots = computed(() => props.maxFiles - photos.value.length)
const isMaxReached = computed(() => photos.value.length >= props.maxFiles)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function revokePreview(url: string) {
  try {
    URL.revokeObjectURL(url)
  } catch {
    /* noop */
  }
}

function emitError(message: string) {
  emit('error', message)
}

function addFiles(files: FileList | File[]) {
  if (props.disabled) return
  const incoming = Array.from(files)
  const drafts: IssuePhotoDraft[] = []
  let skipped = 0

  for (const file of incoming) {
    if (photos.value.length + drafts.length >= props.maxFiles) {
      skipped++
      continue
    }
    if (!ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
      emitError(`Format ${file.name} tidak didukung. Gunakan JPEG, PNG, atau WebP.`)
      continue
    }
    if (file.size > props.maxFileSize) {
      emitError(`Ukuran ${file.name} (${formatBytes(file.size)}) melebihi batas ${formatBytes(props.maxFileSize)}.`)
      continue
    }
    drafts.push({
      uid: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      size: file.size
    })
  }

  if (skipped > 0) {
    emitError(`Maksimal ${props.maxFiles} foto per claim. ${skipped} foto tidak ditambahkan.`)
  }

  if (drafts.length > 0) {
    photos.value = [...photos.value, ...drafts]
  }
}

function removePhoto(uidValue: string) {
  const target = photos.value.find(p => p.uid === uidValue)
  if (target) revokePreview(target.previewUrl)
  photos.value = photos.value.filter(p => p.uid !== uidValue)
}

function openPicker() {
  if (props.disabled || isMaxReached.value) return
  inputRef.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    addFiles(target.files)
  }
  // Reset supaya event change berikutnya untuk file yang sama tetap trigger.
  target.value = ''
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  if (props.disabled || !event.dataTransfer?.files?.length) return
  addFiles(event.dataTransfer.files)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (props.disabled || isMaxReached.value) return
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

// Revoke semua preview URL saat komponen di-unmount untuk mencegah memory leak.
watch(photos, () => {
  // Setiap kali photos berubah, kita sudah mem-revoke URL untuk item yang
  // dihapus. Item baru dibuat dengan URL baru. Tidak ada aksi tambahan di sini.
}, { deep: true })

onBeforeUnmount(() => {
  photos.value.forEach(p => revokePreview(p.previewUrl))
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-highlighted">
          Issue Photos
        </p>
        <p class="text-xs text-muted">
          Dokumentasi visual defect/issue (opsional). Maks {{ maxFiles }} foto, masing-masing maks {{ formatBytes(maxFileSize) }}.
          Format: JPEG, PNG, WebP.
        </p>
      </div>
      <UBadge
        :color="isMaxReached ? 'warning' : 'neutral'"
        variant="subtle"
        :label="`${photos.length} / ${maxFiles}`"
      />
    </div>

    <div
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      :class="{ 'opacity-60 pointer-events-none': disabled }"
    >
      <div
        v-for="photo in photos"
        :key="photo.uid"
        class="relative aspect-square overflow-hidden rounded-md border border-default bg-elevated"
      >
        <img
          :src="photo.previewUrl"
          :alt="photo.file.name"
          class="h-full w-full object-cover"
        >
        <UButton
          type="button"
          icon="i-lucide-x"
          color="error"
          variant="solid"
          size="xs"
          class="absolute right-1 top-1"
          aria-label="Hapus foto"
          @click="removePhoto(photo.uid)"
        />
        <div class="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white">
          <p class="truncate">
            {{ photo.file.name }}
          </p>
          <p>{{ formatBytes(photo.size) }}</p>
        </div>
      </div>

      <button
        v-if="!isMaxReached"
        type="button"
        class="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-default text-muted transition hover:border-primary hover:text-primary"
        :class="{
          'border-primary bg-primary/5 text-primary': dragOver
        }"
        @click="openPicker"
        @drop="onDrop"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
      >
        <UIcon name="i-lucide-image-plus" class="size-6" />
        <span class="text-xs">Tambah foto</span>
      </button>
    </div>

    <input
      ref="inputRef"
      type="file"
      multiple
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="onFileChange"
    >
  </div>
</template>
