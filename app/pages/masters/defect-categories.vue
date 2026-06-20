<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import { getPaginationRowModel } from '@tanstack/table-core'
import { z } from 'zod'

interface DefectCategory {
  id: number
  code: string
  name: string
  description: string | null
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
const selectedCategory = ref<DefectCategory>()
const isSaving = ref(false)
const isDeleting = ref(false)
const isRefreshingStatus = ref(false)

const schema = z.object({
  code: z.string().trim().min(1, 'Kode kategori wajib diisi').max(32, 'Kode kategori maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(120, 'Nama kategori maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional(),
  isActive: z.boolean()
})

type CategoryForm = z.output<typeof schema>

const formState = reactive<CategoryForm>({
  code: '',
  name: '',
  description: '',
  isActive: true
})

const { data: response, status, refresh } = await useFetch<ApiResponse<DefectCategory[]>>('/api/defect-categories', {
  lazy: true
})

const categories = computed(() => response.value?.data ?? [])

const filteredCategories = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return categories.value.filter((category) => {
    const matchesSearch = !keyword
      || category.code.toLowerCase().includes(keyword)
      || category.name.toLowerCase().includes(keyword)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && category.isActive)
      || (statusFilter.value === 'inactive' && !category.isActive)

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
  formState.description = ''
  formState.isActive = true
  selectedCategory.value = undefined
}

function openCreateForm() {
  resetForm()
  isFormOpen.value = true
}

function openEditForm(category: DefectCategory) {
  selectedCategory.value = category
  formState.code = category.code
  formState.name = category.name
  formState.description = category.description ?? ''
  formState.isActive = category.isActive
  isFormOpen.value = true
}

function openDeleteDialog(category: DefectCategory) {
  selectedCategory.value = category
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

async function saveCategory(event: FormSubmitEvent<CategoryForm>) {
  isSaving.value = true

  try {
    const category = selectedCategory.value
    const payload = {
      ...event.data,
      description: event.data.description?.trim() ? event.data.description : null
    }

    if (category) {
      await $fetch(`/api/defect-categories/${category.id}`, {
        method: 'PUT',
        body: payload
      })
    } else {
      await $fetch('/api/defect-categories', {
        method: 'POST',
        body: payload
      })
    }

    await refresh()
    isFormOpen.value = false
    resetForm()

    toast.add({
      title: category ? 'Kategori diperbarui' : 'Kategori ditambahkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menyimpan kategori',
      description: getErrorMessage(error, 'Periksa data kategori lalu coba lagi.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSaving.value = false
  }
}

async function toggleCategoryStatus(category: DefectCategory, isActive: boolean) {
  isRefreshingStatus.value = true

  try {
    await $fetch(`/api/defect-categories/${category.id}`, {
      method: 'PUT',
      body: {
        code: category.code,
        name: category.name,
        description: category.description,
        isActive
      }
    })

    await refresh()

    toast.add({
      title: isActive ? 'Kategori diaktifkan' : 'Kategori dinonaktifkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal mengubah status kategori',
      description: getErrorMessage(error, 'Status kategori belum berubah.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isRefreshingStatus.value = false
  }
}

async function deleteCategory() {
  if (!selectedCategory.value) return

  isDeleting.value = true

  try {
    await $fetch(`/api/defect-categories/${selectedCategory.value.id}`, {
      method: 'DELETE'
    })

    await refresh()
    isDeleteOpen.value = false

    toast.add({
      title: 'Kategori dinonaktifkan',
      description: 'Kategori tetap tersimpan untuk riwayat data.',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menonaktifkan kategori',
      description: getErrorMessage(error, 'Kategori belum berubah.'),
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

function getRowItems(row: Row<DefectCategory>) {
  const category = row.original

  return [
    [{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditForm(category)
    }],
    [{
      label: category.isActive ? 'Nonaktifkan' : 'Aktifkan',
      icon: category.isActive ? 'i-lucide-circle-minus' : 'i-lucide-circle-check',
      color: category.isActive ? 'warning' as const : 'success' as const,
      onSelect: () => category.isActive ? openDeleteDialog(category) : toggleCategoryStatus(category, true)
    }]
  ]
}

const columns: TableColumn<DefectCategory>[] = [{
  accessorKey: 'code',
  header: 'Kode',
  cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.code)
}, {
  accessorKey: 'name',
  header: 'Nama Kategori'
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
    ariaLabel: 'Aksi kategori'
  })))
}]
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Defect Categories
        </h2>
        <p class="text-sm text-muted">
          Kelola pengelompokan defect yang digunakan pada master defect.
        </p>
      </div>

      <UButton
        label="Tambah Kategori"
        icon="i-lucide-plus"
        @click="openCreateForm"
      />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UInput
        v-model="search"
        class="w-full sm:max-w-xs"
        icon="i-lucide-search"
        placeholder="Cari kode atau nama..."
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

    <UTable
      ref="table"
      v-model:pagination="pagination"
      :pagination-options="{
        getPaginationRowModel: getPaginationRowModel()
      }"
      :data="filteredCategories"
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
          Belum ada kategori defect yang cocok.
        </div>
      </template>
    </UTable>

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
      <div class="text-sm text-muted">
        {{ filteredCategories.length }} kategori
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
      :title="selectedCategory ? 'Edit Kategori Defect' : 'Tambah Kategori Defect'"
      :description="selectedCategory ? 'Perbarui detail master kategori defect.' : 'Tambahkan kategori baru untuk mengelompokkan defect.'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="category-form"
          :schema="schema"
          :state="formState"
          class="space-y-4"
          @submit="saveCategory"
        >
          <UFormField name="code" label="Kode" required>
            <UInput
              v-model="formState.code"
              placeholder="ELEC"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="name" label="Nama Kategori" required>
            <UInput
              v-model="formState.name"
              placeholder="Electrical"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="description" label="Deskripsi">
            <UTextarea
              v-model="formState.description"
              placeholder="Penjelasan singkat tentang kategori ini (opsional)"
              :rows="3"
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
          form="category-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Nonaktifkan Kategori Defect"
      :description="`Kategori ${selectedCategory?.name || ''} akan disembunyikan dari pilihan aktif.`"
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
          @click="deleteCategory"
        />
      </template>
    </UModal>
  </div>
</template>
