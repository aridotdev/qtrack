<script setup lang="ts">
/**
 * RichTextEditor
 *
 * Wrapper tipis di atas komponen `UEditor` dari Nuxt UI untuk input
 * `notes` pada jurnal progres klaim (claim_progress_logs).
 *
 * Output berupa HTML string (default `contentType: 'html'`) yang akan
 * disimpan ke kolom `notes` (text) di tabel `claim_progress_logs`.
 * HTML akan di-sanitize sebelum dirender di UI Detail Claim (Task 2.5).
 *
 * Catatan:
 * - `UEditor` sudah menyediakan toolbar built-in (bold/italic/strike,
 *   heading, list, link, image, blockquote, code block, undo/redo, dll).
 * - Untuk upload gambar via picker (bukan URL), override `handlers.image`
 *   menerima File dan upload ke endpoint `attachments`
 *   (`entity_type = 'claim_progress'`) — diintegrasikan pada Task 3.1.
 * - Untuk MVP cukup pakai prompt URL.
 */

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  uploadImage?: (file: File) => Promise<{ url: string, fileName?: string }>
}>(), {
  placeholder: 'Tulis catatan progres...',
  disabled: false,
  uploadImage: undefined
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'imageUploadError', message: string): void
}>()

const isUploadingImage = ref(false)

function insertImage(editor: unknown, url: string, alt: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(editor as any).chain().focus().setImage({ src: url, alt }).run()
}

function fallbackPromptUrl(editor: unknown) {
  const url = window.prompt('URL gambar', 'https://')
  if (!url) return
  insertImage(editor, url, 'gambar')
}

function pickImage(editor: unknown) {
  if (!props.uploadImage) {
    fallbackPromptUrl(editor)
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return

    isUploadingImage.value = true
    try {
      const uploaded = await props.uploadImage!(file)
      insertImage(editor, uploaded.url, uploaded.fileName ?? file.name)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Gagal mengunggah gambar'
      emit('imageUploadError', message)
    } finally {
      isUploadingImage.value = false
    }
  }, { once: true })
  input.click()
}

const handlers = {
  image: {
    canExecute: () => !props.disabled && !isUploadingImage.value,
    execute: (editor: unknown) => pickImage(editor),
    isActive: () => false,
    isDisabled: () => props.disabled || isUploadingImage.value
  }
}
</script>

<template>
  <UEditor
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    content-type="html"
    :handlers="handlers"
    class="w-full"
    @update:model-value="(val: string) => emit('update:modelValue', val)"
  />
</template>

<style scoped>
/* Supaya editor tidak overflow container modal dan min-height konsisten. */
:deep(.ProseMirror) {
  outline: none;
  min-height: 8rem;
}
</style>
