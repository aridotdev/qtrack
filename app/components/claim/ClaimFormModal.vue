<script setup lang="ts">
/**
 * ClaimFormModal
 *
 * Form Create/Edit Claim dengan aturan:
 * - Dropdown bertingkat: Product → Model difilter berdasarkan product yang dipilih.
 *   Defect independent (tidak bergantung pada product).
 * - Issue Photo Uploader terintegrasi (IssuePhotoUploader.vue).
 * - Validasi via Zod, mapping error message dari API ke toast.
 *
 * Catatan:
 * - `claimCode` di-generate otomatis oleh service (tidak ditampilkan di form).
 * - Status default 'OPEN' (lihat schema `claims.status`).
 */

import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import IssuePhotoUploader, { type IssuePhotoDraft } from './IssuePhotoUploader.vue'

interface Product {
  id: number
  code: string
  name: string
  isActive: boolean
}

interface ProductModel {
  id: number
  sku: string
  name: string
  productId: number
  isActive: boolean
}

interface Defect {
  id: number
  code: string
  name: string
  categoryId: number
  categoryName: string | null
  isActive: boolean
}

interface Claim {
  id: number
  claimCode: string
  productId: number
  modelId: number
  defectId: number
  source: string
  description: string
  status: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  /** Claim existing untuk mode edit. Jika undefined = mode create. */
  claim?: Claim | null
}>(), {
  claim: null
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', claim: Claim): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const isEdit = computed(() => Boolean(props.claim))
const toast = useToast()

// ---------------------------------------------------------------------------
// Schema & form state
// ---------------------------------------------------------------------------

const schema = z.object({
  productId: z
    .number({ message: 'Produk wajib dipilih' })
    .int()
    .positive('Produk wajib dipilih'),
  modelId: z
    .number({ message: 'Model wajib dipilih' })
    .int()
    .positive('Model wajib dipilih'),
  defectId: z
    .number({ message: 'Defect wajib dipilih' })
    .int()
    .positive('Defect wajib dipilih'),
  source: z
    .string()
    .trim()
    .min(1, 'Sumber claim wajib diisi')
    .max(120, 'Sumber claim maksimal 120 karakter'),
  description: z
    .string()
    .trim()
    .min(1, 'Deskripsi wajib diisi')
    .max(2000, 'Deskripsi maksimal 2000 karakter')
})

type ClaimForm = z.output<typeof schema>

const formState = reactive<ClaimForm>({
  productId: 0,
  modelId: 0,
  defectId: 0,
  source: '',
  description: ''
})

const photoDrafts = ref<IssuePhotoDraft[]>([])
const isSaving = ref(false)

// ---------------------------------------------------------------------------
// Data master (products, models, defects)
// ---------------------------------------------------------------------------

const { data: productsResponse } = await useFetch<ApiResponse<Product[]>>('/api/products', {
  lazy: true,
  default: () => ({ success: false, data: [] as Product[] })
})

const { data: modelsResponse } = await useFetch<ApiResponse<ProductModel[]>>('/api/products/models', {
  lazy: true,
  default: () => ({ success: false, data: [] as ProductModel[] })
})

const { data: defectsResponse } = await useFetch<ApiResponse<Defect[]>>('/api/defects', {
  lazy: true,
  default: () => ({ success: false, data: [] as Defect[] })
})

const products = computed<Product[]>(() => productsResponse.value?.data ?? [])
const models = computed<ProductModel[]>(() => modelsResponse.value?.data ?? [])
const defects = computed<Defect[]>(() => defectsResponse.value?.data ?? [])

const activeProducts = computed(() => products.value.filter(p => p.isActive))
const activeDefects = computed(() => defects.value.filter(d => d.isActive))

/** Model yang di-filter berdasarkan product yang dipilih (dropdown bertingkat). */
const filteredModels = computed(() =>
  models.value.filter(
    m => m.isActive && m.productId === formState.productId
  )
)

const productSelectItems = computed(() =>
  activeProducts.value.map(p => ({
    label: `${p.code} — ${p.name}`,
    value: p.id
  }))
)

const modelSelectItems = computed(() =>
  filteredModels.value.map(m => ({
    label: `${m.sku} — ${m.name}`,
    value: m.id
  }))
)

const defectSelectItems = computed(() =>
  activeDefects.value.map(d => ({
    label: d.categoryName ? `${d.code} — ${d.name} (${d.categoryName})` : `${d.code} — ${d.name}`,
    value: d.id
  }))
)

// Reset modelId ketika productId berubah, agar tidak ada model yang
// "terbengkalai" dari produk sebelumnya.
watch(() => formState.productId, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) {
    formState.modelId = 0
  }
})

// ---------------------------------------------------------------------------
// Lifecycle: populate form saat edit, reset saat create / modal ditutup
// ---------------------------------------------------------------------------

function resetForm() {
  formState.productId = 0
  formState.modelId = 0
  formState.defectId = 0
  formState.source = ''
  formState.description = ''
  photoDrafts.value.forEach(p => {
    try { URL.revokeObjectURL(p.previewUrl) } catch { /* noop */ }
  })
  photoDrafts.value = []
}

function populateFromClaim(c: Claim) {
  formState.productId = c.productId
  formState.modelId = c.modelId
  formState.defectId = c.defectId
  formState.source = c.source
  formState.description = c.description
  photoDrafts.value = []
}

watch(() => props.claim, (c) => {
  if (c) populateFromClaim(c)
  else resetForm()
}, { immediate: true })

watch(isOpen, (open) => {
  if (open && !props.claim) resetForm()
})

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return fallback
}

async function submit(event: FormSubmitEvent<ClaimForm>) {
  isSaving.value = true
  try {
    const payload = event.data
    const formData = new FormData()
    formData.append('productId', String(payload.productId))
    formData.append('modelId', String(payload.modelId))
    formData.append('defectId', String(payload.defectId))
    formData.append('source', payload.source)
    formData.append('description', payload.description)
    photoDrafts.value.forEach((draft) => {
      formData.append('photos', draft.file, draft.file.name)
    })

    let result: ApiResponse<Claim>

    if (props.claim) {
      // Mode edit — saat ini belum ada API PUT untuk Issue Photos (lihat Task 1.8).
      // Untuk MVP, edit tidak mengirim photos; foto dikelolan lewat endpoint
      // khusus `POST/DELETE /api/claims/:id/photos`.
      const editPayload = {
        productId: payload.productId,
        modelId: payload.modelId,
        defectId: payload.defectId,
        source: payload.source,
        description: payload.description
      }
      result = await $fetch<ApiResponse<Claim>>(`/api/claims/${props.claim.id}`, {
        method: 'PUT',
        body: editPayload
      })
    } else {
      result = await $fetch<ApiResponse<Claim>>('/api/claims', {
        method: 'POST',
        body: formData
      })
    }

    if (!result.success || !result.data) {
      throw new Error(result.message ?? 'Gagal menyimpan claim')
    }

    emit('saved', result.data)
    isOpen.value = false

    toast.add({
      title: isEdit.value ? 'Claim diperbarui' : 'Claim dibuat',
      description: `Kode claim: ${result.data.claimCode}`,
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: isEdit.value ? 'Gagal memperbarui claim' : 'Gagal membuat claim',
      description: getErrorMessage(error, 'Periksa data claim lalu coba lagi.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSaving.value = false
  }
}

function onPhotoError(message: string) {
  toast.add({
    title: 'Foto tidak dapat ditambahkan',
    description: message,
    color: 'warning',
    icon: 'i-lucide-triangle-alert'
  })
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :dismissible="false"
    :title="isEdit ? 'Edit Claim' : 'Claim Baru'"
    :description="isEdit ? 'Perbarui data claim. Kode claim tidak berubah.' : 'Buat claim baru. Kode claim akan dibuat otomatis.'"
    :ui="{ footer: 'justify-end', content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm
        id="claim-form"
        :schema="schema"
        :state="formState"
        class="space-y-4"
        @submit="submit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField name="productId" label="Produk" required>
            <USelect
              v-model="formState.productId"
              :items="productSelectItems"
              value-key="value"
              placeholder="Pilih produk"
              :disabled="productSelectItems.length === 0"
              class="w-full"
            />
          </UFormField>

          <UFormField name="modelId" label="Model" required>
            <USelect
              v-model="formState.modelId"
              :items="modelSelectItems"
              value-key="value"
              :placeholder="formState.productId ? 'Pilih model' : 'Pilih produk dulu'"
              :disabled="!formState.productId || modelSelectItems.length === 0"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField name="defectId" label="Defect" required>
          <USelect
            v-model="formState.defectId"
            :items="defectSelectItems"
            value-key="value"
            placeholder="Pilih defect"
            :disabled="defectSelectItems.length === 0"
            class="w-full"
          />
        </UFormField>

        <UFormField name="source" label="Sumber Claim" required>
          <UInput
            v-model="formState.source"
            placeholder="Contoh: Customer Complaint, Audit Internal, Field Report"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>

        <UFormField name="description" label="Deskripsi" required>
          <UTextarea
            v-model="formState.description"
            :rows="4"
            placeholder="Jelaskan masalah/defect yang ditemukan secara singkat..."
            class="w-full"
          />
        </UFormField>

        <UDivider v-if="!isEdit" label="Issue Photos" />

        <IssuePhotoUploader
          v-if="!isEdit"
          v-model="photoDrafts"
          @error="onPhotoError"
        />

        <div v-if="isEdit" class="rounded-md border border-dashed border-default p-3 text-xs text-muted">
          Untuk menambah/menghapus Issue Photos, gunakan section Issue Photos
          di halaman Detail Claim (Task 2.6).
        </div>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        :disabled="isSaving"
        @click="close"
      />
      <UButton
        type="submit"
        form="claim-form"
        :label="isEdit ? 'Simpan Perubahan' : 'Buat Claim'"
        icon="i-lucide-save"
        :loading="isSaving"
      />
    </template>
  </UModal>
</template>
