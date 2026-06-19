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
const categoryTable = useTemplateRef('categoryTable')
const defectTable = useTemplateRef('defectTable')

const search = ref('')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const categoryFilter = ref<number | null>(null)

const isCategoryFormOpen = ref(false)
const isCategoryDeleteOpen = ref(false)
const selectedCategory = ref<DefectCategory>()
const isSavingCategory = ref(false)
const isDeletingCategory = ref(false)
const isRefreshingCategoryStatus = ref(false)

const isDefectFormOpen = ref(false)
const isDefectDeleteOpen = ref(false)
const selectedDefect = ref<Defect>()
const isSavingDefect = ref(false)
const isDeletingDefect = ref(false)
const isRefreshingDefectStatus = ref(false)

const categorySchema = z.object({
  code: z.string().trim().min(1, 'Kode kategori wajib diisi').max(32, 'Kode kategori maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(120, 'Nama kategori maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional(),
  isActive: z.boolean()
})

type CategoryForm = z.output<typeof categorySchema>

const categoryFormState = reactive<CategoryForm>({
  code: '',
  name: '',
  description: '',
  isActive: true
})

const defectSchema = z.object({
  code: z.string().trim().min(1, 'Kode defect wajib diisi').max(32, 'Kode defect maksimal 32 karakter').transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'Nama defect wajib diisi').max(120, 'Nama defect maksimal 120 karakter'),
  description: z.string().trim().max(500, 'Deskripsi maksimal 500 karakter').optional(),
  categoryId: z.number({ message: 'Kategori defect wajib dipilih' }).int().positive('Kategori defect wajib dipilih'),
  isActive: z.boolean()
})

type DefectForm = z.output<typeof defectSchema>

const defectFormState = reactive<DefectForm>({
  code: '',
  name: '',
  description: '',
  categoryId: 0,
  isActive: true
})

const { data: categoryResponse, refresh: refreshCategories } = await useFetch<ApiResponse<DefectCategory[]>>('/api/defect-categories', {
  lazy: true
})

const { data: defectResponse, refresh: refreshDefects } = await useFetch<ApiResponse<Defect[]>>('/api/defects', {
  lazy: true
})

const categories = computed(() => categoryResponse.value?.data ?? [])
const defects = computed(() => defectResponse.value?.data ?? [])

const activeCategories = computed(() => categories.value.filter(category => category.isActive))

const categorySelectItems = computed(() => activeCategories.value.map(category => ({
  label: `${category.code} — ${category.name}`,
  value: category.id
})))

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

watch(() => categoryFormState.code, (value) => {
  const normalizedValue = value.toUpperCase()

  if (value !== normalizedValue) {
    categoryFormState.code = normalizedValue
  }
})

watch(() => defectFormState.code, (value) => {
  const normalizedValue = value.toUpperCase()

  if (value !== normalizedValue) {
    defectFormState.code = normalizedValue
  }
})

watch([search, statusFilter, categoryFilter], () => {
  categoryTable.value?.tableApi?.setPageIndex(0)
  defectTable.value?.tableApi?.setPageIndex(0)
})

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data

    if (data?.message) {
      return data.message
    }
  }

  return fallback
}

function resetCategoryForm() {
  categoryFormState.code = ''
  categoryFormState.name = ''
  categoryFormState.description = ''
  categoryFormState.isActive = true
  selectedCategory.value = undefined
}

function openCreateCategoryForm() {
  resetCategoryForm()
  isCategoryFormOpen.value = true
}

function openEditCategoryForm(category: DefectCategory) {
  selectedCategory.value = category
  categoryFormState.code = category.code
  categoryFormState.name = category.name
  categoryFormState.description = category.description ?? ''
  categoryFormState.isActive = category.isActive
  isCategoryFormOpen.value = true
}

function openDeleteCategoryDialog(category: DefectCategory) {
  selectedCategory.value = category
  isCategoryDeleteOpen.value = true
}

function resetDefectForm() {
  defectFormState.code = ''
  defectFormState.name = ''
  defectFormState.description = ''
  defectFormState.categoryId = activeCategories.value[0]?.id ?? 0
  defectFormState.isActive = true
  selectedDefect.value = undefined
}

function openCreateDefectForm() {
  resetDefectForm()
  isDefectFormOpen.value = true
}

function openEditDefectForm(defect: Defect) {
  selectedDefect.value = defect
  defectFormState.code = defect.code
  defectFormState.name = defect.name
  defectFormState.description = defect.description ?? ''
  defectFormState.categoryId = defect.categoryId
  defectFormState.isActive = defect.isActive
  isDefectFormOpen.value = true
}

function openDeleteDefectDialog(defect: Defect) {
  selectedDefect.value = defect
  isDefectDeleteOpen.value = true
}

async function saveCategory(event: FormSubmitEvent<CategoryForm>) {
  isSavingCategory.value = true

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

    await refreshCategories()
    isCategoryFormOpen.value = false
    resetCategoryForm()

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
    isSavingCategory.value = false
  }
}

async function toggleCategoryStatus(category: DefectCategory, isActive: boolean) {
  isRefreshingCategoryStatus.value = true

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

    await refreshCategories()

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
    isRefreshingCategoryStatus.value = false
  }
}

async function deleteCategory() {
  if (!selectedCategory.value) return

  isDeletingCategory.value = true

  try {
    await $fetch(`/api/defect-categories/${selectedCategory.value.id}`, {
      method: 'DELETE'
    })

    await refreshCategories()
    await refreshDefects()
    isCategoryDeleteOpen.value = false

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
    isDeletingCategory.value = false
  }
}

async function saveDefect(event: FormSubmitEvent<DefectForm>) {
  isSavingDefect.value = true

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

    await refreshDefects()
    isDefectFormOpen.value = false
    resetDefectForm()

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
    isSavingDefect.value = false
  }
}

async function toggleDefectStatus(defect: Defect, isActive: boolean) {
  isRefreshingDefectStatus.value = true

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

    await refreshDefects()

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
    isRefreshingDefectStatus.value = false
  }
}

async function deleteDefect() {
  if (!selectedDefect.value) return

  isDeletingDefect.value = true

  try {
    await $fetch(`/api/defects/${selectedDefect.value.id}`, {
      method: 'DELETE'
    })

    await refreshDefects()
    isDefectDeleteOpen.value = false

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
    isDeletingDefect.value = false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function getCategoryRowItems(row: Row<DefectCategory>) {
  const category = row.original

  return [
    [{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditCategoryForm(category)
    }],
    [{
      label: category.isActive ? 'Nonaktifkan' : 'Aktifkan',
      icon: category.isActive ? 'i-lucide-circle-minus' : 'i-lucide-circle-check',
      color: category.isActive ? 'warning' as const : 'success' as const,
      onSelect: () => category.isActive ? openDeleteCategoryDialog(category) : toggleCategoryStatus(category, true)
    }]
  ]
}

function getDefectRowItems(row: Row<Defect>) {
  const defect = row.original

  return [
    [{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditDefectForm(defect)
    }],
    [{
      label: defect.isActive ? 'Nonaktifkan' : 'Aktifkan',
      icon: defect.isActive ? 'i-lucide-circle-minus' : 'i-lucide-circle-check',
      color: defect.isActive ? 'warning' as const : 'success' as const,
      onSelect: () => defect.isActive ? openDeleteDefectDialog(defect) : toggleDefectStatus(defect, true)
    }]
  ]
}

const categoryColumns: TableColumn<DefectCategory>[] = [{
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
    items: getCategoryRowItems(row)
  }, () => h(UButton, {
    icon: 'i-lucide-ellipsis-vertical',
    color: 'neutral',
    variant: 'ghost',
    loading: isRefreshingCategoryStatus.value,
    class: 'ml-auto',
    ariaLabel: 'Aksi kategori'
  })))
}]

const defectColumns: TableColumn<Defect>[] = [{
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
    label: row.original.categoryName ?? '—'
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
    items: getDefectRowItems(row)
  }, () => h(UButton, {
    icon: 'i-lucide-ellipsis-vertical',
    color: 'neutral',
    variant: 'ghost',
    loading: isRefreshingDefectStatus.value,
    class: 'ml-auto',
    ariaLabel: 'Aksi defect'
  })))
}]
</script>

<template>
  <div class="flex flex-col gap-6 sm:gap-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Master Defect
        </h2>
        <p class="text-sm text-muted">
          Kelola kategori dan jenis defect yang digunakan pada pencatatan claim.
        </p>
      </div>
    </div>

    <!-- Section: Kategori Defect -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-highlighted">
            Kategori Defect
          </h3>
          <p class="text-sm text-muted">
            Grouping broad untuk pengelompokan defect (mis. Electrical, Mechanical).
          </p>
        </div>

        <UButton
          label="Tambah Kategori"
          icon="i-lucide-plus"
          @click="openCreateCategoryForm"
        />
      </div>

      <UTable
        ref="categoryTable"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel()
        }"
        :data="filteredCategories"
        :columns="categoryColumns"
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
            Belum ada kategori defect.
          </div>
        </template>
      </UTable>
    </section>

    <!-- Section: Defect -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-highlighted">
            Defect
          </h3>
          <p class="text-sm text-muted">
            Jenis defect spesifik yang terikat pada satu kategori.
          </p>
        </div>

        <UButton
          label="Tambah Defect"
          icon="i-lucide-plus"
          :disabled="activeCategories.length === 0"
          @click="openCreateDefectForm"
        />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="search"
          class="w-full sm:max-w-xs"
          icon="i-lucide-search"
          placeholder="Cari kode atau nama..."
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
        ref="defectTable"
        v-model:pagination="pagination"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel()
        }"
        :data="filteredDefects"
        :columns="defectColumns"
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
    </section>

    <!-- Modal: Form Kategori -->
    <UModal
      v-model:open="isCategoryFormOpen"
      :title="selectedCategory ? 'Edit Kategori Defect' : 'Tambah Kategori Defect'"
      :description="selectedCategory ? 'Perbarui detail master kategori defect.' : 'Tambahkan kategori baru untuk mengelompokkan defect.'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="category-form"
          :schema="categorySchema"
          :state="categoryFormState"
          class="space-y-4"
          @submit="saveCategory"
        >
          <UFormField name="code" label="Kode" required>
            <UInput
              v-model="categoryFormState.code"
              placeholder="ELEC"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="name" label="Nama Kategori" required>
            <UInput
              v-model="categoryFormState.name"
              placeholder="Electrical"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="description" label="Deskripsi">
            <UTextarea
              v-model="categoryFormState.description"
              placeholder="Penjelasan singkat tentang kategori ini (opsional)"
              :rows="3"
            />
          </UFormField>

          <UFormField name="isActive">
            <UCheckbox
              v-model="categoryFormState.isActive"
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
          :disabled="isSavingCategory"
          @click="close"
        />
        <UButton
          type="submit"
          form="category-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSavingCategory"
        />
      </template>
    </UModal>

    <!-- Modal: Konfirmasi Nonaktifkan Kategori -->
    <UModal
      v-model:open="isCategoryDeleteOpen"
      title="Nonaktifkan Kategori Defect"
      :description="`Kategori ${selectedCategory?.name || ''} akan disembunyikan dari pilihan aktif.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isDeletingCategory"
          @click="close"
        />
        <UButton
          label="Nonaktifkan"
          color="error"
          icon="i-lucide-trash"
          :loading="isDeletingCategory"
          @click="deleteCategory"
        />
      </template>
    </UModal>

    <!-- Modal: Form Defect -->
    <UModal
      v-model:open="isDefectFormOpen"
      :title="selectedDefect ? 'Edit Defect' : 'Tambah Defect'"
      :description="selectedDefect ? 'Perbarui detail master defect.' : 'Tambahkan jenis defect baru ke master data.'"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <UForm
          id="defect-form"
          :schema="defectSchema"
          :state="defectFormState"
          class="space-y-4"
          @submit="saveDefect"
        >
          <UFormField name="categoryId" label="Kategori" required>
            <USelect
              v-model="defectFormState.categoryId"
              :items="categorySelectItems"
              value-key="value"
              placeholder="Pilih kategori"
            />
          </UFormField>

          <UFormField name="code" label="Kode" required>
            <UInput
              v-model="defectFormState.code"
              placeholder="BAT-LEAK"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="name" label="Nama Defect" required>
            <UInput
              v-model="defectFormState.name"
              placeholder="Battery Leak"
              autocomplete="off"
            />
          </UFormField>

          <UFormField name="description" label="Deskripsi">
            <UTextarea
              v-model="defectFormState.description"
              placeholder="Penjelasan singkat tentang defect (opsional)"
              :rows="3"
            />
          </UFormField>

          <UFormField name="isActive">
            <UCheckbox
              v-model="defectFormState.isActive"
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
          :disabled="isSavingDefect"
          @click="close"
        />
        <UButton
          type="submit"
          form="defect-form"
          label="Simpan"
          icon="i-lucide-save"
          :loading="isSavingDefect"
        />
      </template>
    </UModal>

    <!-- Modal: Konfirmasi Nonaktifkan Defect -->
    <UModal
      v-model:open="isDefectDeleteOpen"
      title="Nonaktifkan Defect"
      :description="`Defect ${selectedDefect?.name || ''} akan disembunyikan dari pilihan aktif.`"
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          :disabled="isDeletingDefect"
          @click="close"
        />
        <UButton
          label="Nonaktifkan"
          color="error"
          icon="i-lucide-trash"
          :loading="isDeletingDefect"
          @click="deleteDefect"
        />
      </template>
    </UModal>
  </div>
</template>
