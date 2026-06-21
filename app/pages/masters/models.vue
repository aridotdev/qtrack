<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'
import { z } from 'zod'

interface Product {
  id: number
  code: string
  name: string
  isActive: boolean
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

interface ProductModel {
  id: number
  sku: string
  name: string
  productId: number
  productCode: string | null
  productName: string | null
  isActive: boolean
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const toast = useToast()
const table = useTemplateRef('table')

const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const productFilter = ref<number | null>(null)

const isFormOpen = ref(false)
const isDeleteOpen = ref(false)
const selectedModel = ref<ProductModel>()
const isSaving = ref(false)
const isDeleting = ref(false)
const isRefreshingStatus = ref(false)

const schema = z.object({
  productId: z.number({ message: 'Produk wajib dipilih' }).int().positive('Produk wajib dipilih'),
  sku: z.string().trim().min(1, 'SKU model wajib diisi').max(64, 'SKU model maksimal 64 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama model wajib diisi').max(120, 'Nama model maksimal 120 karakter'),
  isActive: z.boolean()
})

type ModelForm = z.output<typeof schema>

const formState = reactive<ModelForm>({
  productId: 0,
  sku: '',
  name: '',
  isActive: true
})

const { data: productResponse, status: productStatus } = await useFetch<ApiResponse<Product[]>>('/api/products', {
  lazy: true
})

const { data: modelResponse, status, refresh } = await useFetch<ApiResponse<ProductModel[]>>('/api/products/models', {
  lazy: true
})

const products = computed(() => productResponse.value?.data ?? [])
const models = computed(() => modelResponse.value?.data ?? [])

const activeProducts = computed(() => products.value.filter(product => product.isActive))

const productFilterItems = computed(() => products.value.map(product => ({
  label: `${product.code} - ${product.name}`,
  value: product.id
})))

const productSelectItems = computed(() => products.value
  .filter(product => product.isActive || product.id === formState.productId)
  .map(product => ({
    label: `${product.code} - ${product.name}`,
    value: product.id
  })))

const filteredModels = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return models.value.filter((model) => {
    const matchesSearch = !keyword
      || model.sku.toLowerCase().includes(keyword)
      || model.name.toLowerCase().includes(keyword)
      || (model.productCode?.toLowerCase().includes(keyword) ?? false)
      || (model.productName?.toLowerCase().includes(keyword) ?? false)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && model.isActive)
      || (statusFilter.value === 'inactive' && !model.isActive)
    const matchesProduct = productFilter.value === null
      || model.productId === productFilter.value

    return matchesSearch && matchesStatus && matchesProduct
  })
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

watch(() => formState.sku, (value) => {
  const normalizedValue = value.toUpperCase()

  if (value !== normalizedValue) {
    formState.sku = normalizedValue
  }
})

watch([search, statusFilter, productFilter], () => {
  table.value?.tableApi?.setPageIndex(0)
})

function resetForm() {
  formState.productId = activeProducts.value[0]?.id ?? 0
  formState.sku = ''
  formState.name = ''
  formState.isActive = true
  selectedModel.value = undefined
}

function openCreateForm() {
  resetForm()
  isFormOpen.value = true
}

function openEditForm(model: ProductModel) {
  selectedModel.value = model
  formState.productId = model.productId
  formState.sku = model.sku
  formState.name = model.name
  formState.isActive = model.isActive
  isFormOpen.value = true
}

function openDeleteDialog(model: ProductModel) {
  selectedModel.value = model
  isDeleteOpen.value = true
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data

    if (data?.message) {
      return data.message
    }
  }

  return fallback
}

async function saveModel(event: FormSubmitEvent<ModelForm>) {
  isSaving.value = true

  try {
    const model = selectedModel.value

    if (model) {
      await $fetch(`/api/products/models/${model.id}`, {
        method: 'PUT',
        body: event.data
      })
    } else {
      await $fetch('/api/products/models', {
        method: 'POST',
        body: event.data
      })
    }

    await refresh()
    isFormOpen.value = false
    resetForm()

    toast.add({
      title: model ? 'Model diperbarui' : 'Model ditambahkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menyimpan model',
      description: getErrorMessage(error, 'Periksa data model lalu coba lagi.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSaving.value = false
  }
}

async function toggleModelStatus(model: ProductModel, isActive: boolean) {
  isRefreshingStatus.value = true

  try {
    await $fetch(`/api/products/models/${model.id}`, {
      method: 'PUT',
      body: {
        productId: model.productId,
        sku: model.sku,
        name: model.name,
        isActive
      }
    })

    await refresh()

    toast.add({
      title: isActive ? 'Model diaktifkan' : 'Model dinonaktifkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal mengubah status model',
      description: getErrorMessage(error, 'Status model belum berubah.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isRefreshingStatus.value = false
  }
}

async function deleteModel() {
  if (!selectedModel.value) return

  isDeleting.value = true

  try {
    await $fetch(`/api/products/models/${selectedModel.value.id}`, {
      method: 'DELETE'
    })

    await refresh()
    isDeleteOpen.value = false

    toast.add({
      title: 'Model dinonaktifkan',
      description: 'Model tetap tersimpan untuk riwayat data.',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menonaktifkan model',
      description: getErrorMessage(error, 'Model belum berubah.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isDeleting.value = false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function getProductLabel(model: ProductModel) {
  if (!model.productCode && !model.productName) {
    return '-'
  }

  return [model.productCode, model.productName].filter(Boolean).join(' - ')
}

function getRowItems(row: Row<ProductModel>) {
  const model = row.original

  return [
    [{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditForm(model)
    }],
    [{
      label: model.isActive ? 'Nonaktifkan' : 'Aktifkan',
      icon: model.isActive ? 'i-lucide-circle-minus' : 'i-lucide-circle-check',
      color: model.isActive ? 'warning' as const : 'success' as const,
      onSelect: () => model.isActive ? openDeleteDialog(model) : toggleModelStatus(model, true)
    }]
  ]
}

const columns: TableColumn<ProductModel>[] = [{
  accessorKey: 'sku',
  header: 'SKU',
  cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.sku)
}, {
  accessorKey: 'name',
  header: 'Nama Model'
}, {
  accessorKey: 'productName',
  header: 'Produk',
  cell: ({ row }) => h(UBadge, {
    color: 'primary',
    variant: 'subtle',
    label: getProductLabel(row.original)
  })
}, {
  accessorKey: 'isActive',
  header: 'Status',
  cell: ({ row }) => h(UBadge, {
    color: row.original.isActive ? 'success' : 'neutral',
    variant: 'subtle',
    label: row.original.isActive ? 'Aktif' : 'Nonaktif'
  })
}, {
  accessorKey: 'updatedAt',
  header: 'Terakhir Diubah',
  cell: ({ row }) => h('span', { class: 'text-muted' }, formatDate(row.original.updatedAt))
}, {
  id: 'actions',
  cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
    content: { align: 'end' },
    items: getRowItems(row)
  }, () => h(UButton, {
    icon: 'i-lucide-ellipsis-vertical',
    color: 'neutral',
    variant: 'ghost',
    loading: isRefreshingStatus.value,
    class: 'ml-auto',
    ariaLabel: 'Aksi model'
  })))
}]
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Master Models
        </h2>
        <p class="text-sm text-muted">
          Kelola model atau SKU turunan dari master produk.
        </p>
      </div>

      <UButton
        label="Tambah Model"
        icon="i-lucide-plus"
        :disabled="activeProducts.length === 0"
        @click="openCreateForm"
      />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UInput
        v-model="search"
        class="w-full sm:max-w-xs"
        icon="i-lucide-search"
        placeholder="Cari SKU, model, atau produk..."
      />

      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="productFilter"
          :items="[
            { label: 'Semua produk', value: null },
            ...productFilterItems
          ]"
          value-key="value"
          class="min-w-48"
          placeholder="Filter produk"
        />

        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'Semua status', value: 'all' },
            { label: 'Aktif', value: 'active' },
            { label: 'Nonaktif', value: 'inactive' }
          ]"
          class="min-w-36"
        />
      </div>
    </div>

    <UTable
      ref="table"
      v-model:pagination="pagination"
      :pagination-options="{
        getPaginationRowModel: getPaginationRowModel()
      }"
      :data="filteredModels"
      :columns="columns"
      :loading="status === 'pending' || status === 'idle' || productStatus === 'pending' || productStatus === 'idle'"
      class="shrink-0"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    >
      <template #empty>
        <div class="py-8 text-center text-sm text-muted">
          <template v-if="activeProducts.length === 0">
            Tambahkan produk aktif terlebih dahulu untuk mulai mengelola model.
          </template>
          <template v-else>
            Belum ada model yang cocok.
          </template>
        </div>
      </template>
    </UTable>

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
      <div class="text-sm text-muted">
        {{ filteredModels.length }} model
      </div>

      <UPagination
        :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
        :items-per-page="table?.tableApi?.getState().pagination.pageSize"
        :total="table?.tableApi?.getFilteredRowModel().rows.length"
        @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)"
      />
    </div>

    <UModal
      v-model:open="isFormOpen"
      :title="selectedModel ? 'Edit Model' : 'Tambah Model'"
      :description="selectedModel ? 'Perbarui detail master model.' : 'Tambahkan model baru untuk produk tertentu.'"
      :ui="{ content: 'sm:max-w-md', footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="model-form"
          :schema="schema"
          :state="formState"
          class="space-y-4"
          @submit="saveModel"
        >
          <UFormField name="productId" label="Produk" required>
            <USelect
              v-model="formState.productId"
              :items="productSelectItems"
              value-key="value"
              placeholder="Pilih produk"
              class="min-w-[50%]"
            />
          </UFormField>

          <UFormField name="sku" label="SKU" required>
            <UInput
              v-model="formState.sku"
              placeholder="LCD-43A"
              autocomplete="on"
              class="min-w-[50%]"
            />
          </UFormField>

          <UFormField name="name" label="Nama Model" required>
            <UInput
              v-model="formState.name"
              placeholder="LCD 43 inch A Series"
              autocomplete="on"
              class="min-w-[50%]"
            />
          </UFormField>

          <UFormField name="isActive">
            <UCheckbox
              v-model="formState.isActive"
              label="Aktif"
            />
          </UFormField>
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
          form="model-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Nonaktifkan Model"
      :description="`Model ${selectedModel?.name || ''} akan disembunyikan dari pilihan aktif.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isDeleting"
          @click="close"
        />
        <UButton
          label="Nonaktifkan"
          color="error"
          icon="i-lucide-trash"
          :loading="isDeleting"
          @click="deleteModel"
        />
      </template>
    </UModal>
  </div>
</template>
