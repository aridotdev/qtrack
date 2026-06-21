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
}>(), {
  placeholder: 'Tulis catatan progres...',
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

/**
 * Override `image` handler: tetap gunakan prompt URL untuk MVP.
 * TODO (Task 3.1): integrasikan picker + upload ke endpoint attachments.
 */
const handlers = {
  image: {
    canExecute: () => !props.disabled,
    execute: (editor: { chain: () => { focus: () => unknown } }) => {
      const url = window.prompt('URL gambar', 'https://')
      if (!url) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(editor as any).chain().focus().setImage({ src: url, alt: 'gambar' }).run()
    },
    isActive: () => false,
    isDisabled: () => props.disabled
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
