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
const isFormOpen = ref(false)
const isDeleteOpen = ref(false)
const selectedProduct = ref<Product>()
const isSaving = ref(false)
const isDeleting = ref(false)
const isRefreshingStatus = ref(false)

const schema = z.object({
  code: z.string().trim().min(1, 'Kode produk wajib diisi').max(32, 'Kode produk maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama produk wajib diisi').max(120, 'Nama produk maksimal 120 karakter'),
  isActive: z.boolean()
})

type ProductForm = z.output<typeof schema>

const formState = reactive<ProductForm>({
  code: '',
  name: '',
  isActive: true
})

const { data: response, status, refresh } = await useFetch<ApiResponse<Product[]>>('/api/products', {
  lazy: true
})

const products = computed(() => response.value?.data ?? [])

const filteredProducts = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return products.value.filter((product) => {
    const matchesSearch = !keyword
      || product.code.toLowerCase().includes(keyword)
      || product.name.toLowerCase().includes(keyword)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && product.isActive)
      || (statusFilter.value === 'inactive' && !product.isActive)

    return matchesSearch && matchesStatus
  })
})

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

watch(() => formState.code, (value) => {
  const normalizedValue = value.toUpperCase()

  if (value !== normalizedValue) {
    formState.code = normalizedValue
  }
})

watch([search, statusFilter], () => {
  table.value?.tableApi?.setPageIndex(0)
})

function resetForm() {
  formState.code = ''
  formState.name = ''
  formState.isActive = true
  selectedProduct.value = undefined
}

function openCreateForm() {
  resetForm()
  isFormOpen.value = true
}

function openEditForm(product: Product) {
  selectedProduct.value = product
  formState.code = product.code
  formState.name = product.name
  formState.isActive = product.isActive
  isFormOpen.value = true
}

function openDeleteDialog(product: Product) {
  selectedProduct.value = product
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

async function saveProduct(event: FormSubmitEvent<ProductForm>) {
  isSaving.value = true

  try {
    const product = selectedProduct.value

    if (product) {
      await $fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        body: event.data
      })
    } else {
      await $fetch('/api/products', {
        method: 'POST',
        body: event.data
      })
    }

    await refresh()
    isFormOpen.value = false
    resetForm()

    toast.add({
      title: product ? 'Produk diperbarui' : 'Produk ditambahkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menyimpan produk',
      description: getErrorMessage(error, 'Periksa data produk lalu coba lagi.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSaving.value = false
  }
}

async function toggleProductStatus(product: Product, isActive: boolean) {
  isRefreshingStatus.value = true

  try {
    await $fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      body: {
        code: product.code,
        name: product.name,
        isActive
      }
    })

    await refresh()

    toast.add({
      title: isActive ? 'Produk diaktifkan' : 'Produk dinonaktifkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal mengubah status produk',
      description: getErrorMessage(error, 'Status produk belum berubah.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isRefreshingStatus.value = false
  }
}

async function deleteProduct() {
  if (!selectedProduct.value) return

  isDeleting.value = true

  try {
    await $fetch(`/api/products/${selectedProduct.value.id}`, {
      method: 'DELETE'
    })

    await refresh()
    isDeleteOpen.value = false

    toast.add({
      title: 'Produk dinonaktifkan',
      description: 'Produk tetap tersimpan untuk riwayat data.',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menonaktifkan produk',
      description: getErrorMessage(error, 'Produk belum berubah.'),
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

function getRowItems(row: Row<Product>) {
  const product = row.original

  return [
    [{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditForm(product)
    }],
    [{
      label: product.isActive ? 'Nonaktifkan' : 'Aktifkan',
      icon: product.isActive ? 'i-lucide-circle-minus' : 'i-lucide-circle-check',
      color: product.isActive ? 'warning' as const : 'success' as const,
      onSelect: () => product.isActive ? openDeleteDialog(product) : toggleProductStatus(product, true)
    }]
  ]
}

const columns: TableColumn<Product>[] = [{
  accessorKey: 'code',
  header: 'Kode',
  cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.code)
}, {
  accessorKey: 'name',
  header: 'Nama Produk'
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
    ariaLabel: 'Aksi produk'
  })))
}]
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UInput
        v-model="search"
        class="w-full sm:max-w-xs"
        icon="i-lucide-search"
        placeholder="Cari kode atau nama..."
      />

      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="statusFilter"
          :items="[
            { label: 'Semua status', value: 'all' },
            { label: 'Aktif', value: 'active' },
            { label: 'Nonaktif', value: 'inactive' }
          ]"
          class="min-w-36"
        />

        <UButton
          label="Tambah Produk"
          icon="i-lucide-plus"
          @click="openCreateForm"
        />
      </div>
    </div>

    <UTable
      ref="table"
      v-model:pagination="pagination"
      :pagination-options="{
        getPaginationRowModel: getPaginationRowModel()
      }"
      :data="filteredProducts"
      :columns="columns"
      :loading="status === 'pending' || status === 'idle'"
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
          Belum ada produk yang cocok.
        </div>
      </template>
    </UTable>

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
      <div class="text-sm text-muted">
        {{ filteredProducts.length }} produk
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
      :title="selectedProduct ? 'Edit Produk' : 'Tambah Produk'"
      :description="selectedProduct ? 'Perbarui detail master produk.' : 'Tambahkan produk baru ke master data.'"
      :ui="{ content: 'sm:max-w-sm', footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="product-form"
          :schema="schema"
          :state="formState"
          class="space-y-4"
          @submit="saveProduct"
        >
          <UFormField name="code" label="Kode" required>
            <UInput
              v-model="formState.code"
              placeholder="TV"
              autocomplete="on"
              class="w-full"
            />
          </UFormField>

          <UFormField name="name" label="Nama Produk" required>
            <UInput
              v-model="formState.name"
              placeholder="Television"
              autocomplete="on"
              class="w-full"
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
          form="product-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Nonaktifkan Produk"
      :description="`Produk ${selectedProduct?.name || ''} akan disembunyikan dari pilihan aktif.`"
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
          @click="deleteProduct"
        />
      </template>
    </UModal>
  </div>
</template>
