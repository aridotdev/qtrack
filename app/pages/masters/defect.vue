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

interface Defect {
  id: number
  code: string
  name: string
  description: string | null
  categoryId: number
  categoryName: string | null
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
const categoryFilter = ref<number | null>(null)

const isFormOpen = ref(false)
const isDeleteOpen = ref(false)
const selectedDefect = ref<Defect>()
const isSaving = ref(false)
const isDeleting = ref(false)
const isRefreshingStatus = ref(false)

const schema = z.object({
  code: z.string().trim().min(1, 'Kode defect wajib diisi').max(32, 'Kode defect maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama defect wajib diisi').max(120, 'Nama defect maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional(),
  categoryId: z.number({ message: 'Kategori defect wajib dipilih' }).int().positive('Kategori defect wajib dipilih'),
  isActive: z.boolean()
})

type DefectForm = z.output<typeof schema>

const formState = reactive<DefectForm>({
  code: '',
  name: '',
  description: '',
  categoryId: 0,
  isActive: true
})

const { data: categoryResponse, status: categoryStatus } = await useFetch<ApiResponse<DefectCategory[]>>('/api/defect-categories', {
  lazy: true
})

const { data: defectResponse, status, refresh } = await useFetch<ApiResponse<Defect[]>>('/api/defects', {
  lazy: true
})

const categories = computed(() => categoryResponse.value?.data ?? [])
const defects = computed(() => defectResponse.value?.data ?? [])

const activeCategories = computed(() => categories.value.filter(category => category.isActive))

const categorySelectItems = computed(() => activeCategories.value.map(category => ({
  label: `${category.code} - ${category.name}`,
  value: category.id
})))

const filteredDefects = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return defects.value.filter((defect) => {
    const matchesSearch = !keyword
      || defect.code.toLowerCase().includes(keyword)
      || defect.name.toLowerCase().includes(keyword)
      || (defect.categoryName?.toLowerCase().includes(keyword) ?? false)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' && defect.isActive)
      || (statusFilter.value === 'inactive' && !defect.isActive)
    const matchesCategory = categoryFilter.value === null
      || defect.categoryId === categoryFilter.value

    return matchesSearch && matchesStatus && matchesCategory
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

watch([search, statusFilter, categoryFilter], () => {
  table.value?.tableApi?.setPageIndex(0)
})

function resetForm() {
  formState.code = ''
  formState.name = ''
  formState.description = ''
  formState.categoryId = activeCategories.value[0]?.id ?? 0
  formState.isActive = true
  selectedDefect.value = undefined
}

function openCreateForm() {
  resetForm()
  isFormOpen.value = true
}

function openEditForm(defect: Defect) {
  selectedDefect.value = defect
  formState.code = defect.code
  formState.name = defect.name
  formState.description = defect.description ?? ''
  formState.categoryId = defect.categoryId
  formState.isActive = defect.isActive
  isFormOpen.value = true
}

function openDeleteDialog(defect: Defect) {
  selectedDefect.value = defect
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

async function saveDefect(event: FormSubmitEvent<DefectForm>) {
  isSaving.value = true

  try {
    const defect = selectedDefect.value
    const payload = {
      ...event.data,
      description: event.data.description?.trim() ? event.data.description : null
    }

    if (defect) {
      await $fetch(`/api/defects/${defect.id}`, {
        method: 'PUT',
        body: payload
      })
    } else {
      await $fetch('/api/defects', {
        method: 'POST',
        body: payload
      })
    }

    await refresh()
    isFormOpen.value = false
    resetForm()

    toast.add({
      title: defect ? 'Defect diperbarui' : 'Defect ditambahkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menyimpan defect',
      description: getErrorMessage(error, 'Periksa data defect lalu coba lagi.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isSaving.value = false
  }
}

async function toggleDefectStatus(defect: Defect, isActive: boolean) {
  isRefreshingStatus.value = true

  try {
    await $fetch(`/api/defects/${defect.id}`, {
      method: 'PUT',
      body: {
        code: defect.code,
        name: defect.name,
        description: defect.description,
        categoryId: defect.categoryId,
        isActive
      }
    })

    await refresh()

    toast.add({
      title: isActive ? 'Defect diaktifkan' : 'Defect dinonaktifkan',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal mengubah status defect',
      description: getErrorMessage(error, 'Status defect belum berubah.'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isRefreshingStatus.value = false
  }
}

async function deleteDefect() {
  if (!selectedDefect.value) return

  isDeleting.value = true

  try {
    await $fetch(`/api/defects/${selectedDefect.value.id}`, {
      method: 'DELETE'
    })

    await refresh()
    isDeleteOpen.value = false

    toast.add({
      title: 'Defect dinonaktifkan',
      description: 'Defect tetap tersimpan untuk riwayat data.',
      color: 'success',
      icon: 'i-lucide-check-circle'
    })
  } catch (error) {
    toast.add({
      title: 'Gagal menonaktifkan defect',
      description: getErrorMessage(error, 'Defect belum berubah.'),
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

function getRowItems(row: Row<Defect>) {
  const defect = row.original

  return [
    [{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditForm(defect)
    }],
    [{
      label: defect.isActive ? 'Nonaktifkan' : 'Aktifkan',
      icon: defect.isActive ? 'i-lucide-circle-minus' : 'i-lucide-circle-check',
      color: defect.isActive ? 'warning' as const : 'success' as const,
      onSelect: () => defect.isActive ? openDeleteDialog(defect) : toggleDefectStatus(defect, true)
    }]
  ]
}

const columns: TableColumn<Defect>[] = [{
  accessorKey: 'code',
  header: 'Kode',
  cell: ({ row }) => h('span', { class: 'font-medium text-highlighted' }, row.original.code)
}, {
  accessorKey: 'name',
  header: 'Nama Defect'
}, {
  accessorKey: 'categoryName',
  header: 'Kategori',
  cell: ({ row }) => h(UBadge, {
    color: 'primary',
    variant: 'subtle',
    label: row.original.categoryName ?? '-'
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
  accessorKey: 'description',
  header: 'Deskripsi'
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
    ariaLabel: 'Aksi defect'
  })))
}]
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Master Defect
        </h2>
        <p class="text-sm text-muted">
          Kelola jenis defect spesifik yang terikat pada satu kategori.
        </p>
      </div>

      <UButton
        label="Tambah Defect"
        icon="i-lucide-plus"
        :disabled="activeCategories.length === 0"
        @click="openCreateForm"
      />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UInput
        v-model="search"
        class="w-full sm:max-w-xs"
        icon="i-lucide-search"
        placeholder="Cari kode, nama, atau kategori..."
      />

      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="categoryFilter"
          :items="[
            { label: 'Semua kategori', value: null },
            ...categorySelectItems
          ]"
          value-key="value"
          class="min-w-48"
          placeholder="Filter kategori"
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
      :data="filteredDefects"
      :columns="columns"
      :loading="status === 'pending' || status === 'idle' || categoryStatus === 'pending' || categoryStatus === 'idle'"
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
          <template v-if="activeCategories.length === 0">
            Tambahkan kategori defect terlebih dahulu untuk mulai mengelola jenis defect.
          </template>
          <template v-else>
            Belum ada defect yang cocok.
          </template>
        </div>
      </template>
    </UTable>

    <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
      <div class="text-sm text-muted">
        {{ filteredDefects.length }} defect
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
      :title="selectedDefect ? 'Edit Defect' : 'Tambah Defect'"
      :description="selectedDefect ? 'Perbarui detail master defect.' : 'Tambahkan jenis defect baru ke master data.'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="defect-form"
          :schema="schema"
          :state="formState"
          class="space-y-4"
          @submit="saveDefect"
        >
          <UFormField name="categoryId" label="Kategori" required>
            <USelect
              v-model="formState.categoryId"
              :items="categorySelectItems"
              value-key="value"
              placeholder="Pilih kategori"
            />
          </UFormField>

          <UFormField name="code" label="Kode" required>
            <UInput
              v-model="formState.code"
              placeholder="BAT-LEAK"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="name" label="Nama Defect" required>
            <UInput
              v-model="formState.name"
              placeholder="Battery Leak"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="description" label="Deskripsi">
            <UTextarea
              v-model="formState.description"
              placeholder="Penjelasan singkat tentang defect (opsional)"
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
          form="defect-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSaving"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isDeleteOpen"
      title="Nonaktifkan Defect"
      :description="`Defect ${selectedDefect?.name || ''} akan disembunyikan dari pilihan aktif.`"
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
          @click="deleteDefect"
        />
      </template>
    </UModal>
  </div>
</template>
