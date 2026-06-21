<script setup lang="ts">
/**
 * Halaman List Claim (Task 2.1 + 2.2)
 *
 * Menampilkan daftar klaim dalam tabel data (Nuxt UI) dengan:
 * - Pencarian (claim code / source / product / model / defect)
 * - Filter status (OPEN / WAITING_PQA / ON_PROGRESS / CLOSED)
 * - Pagination
 * - Tombol "Buat Claim" membuka ClaimFormModal
 * - Tombol edit per baris (placeholder, lihat Task 2.5 untuk detail)
 *
 * Data diambil via composable `useClaims()` (Task 2.2) → `GET /api/claims`.
 * API endpoint ini diimplementasikan pada Task 1.4; untuk sekarang
 * composable sudah siap dan akan otomatis aktif saat route handler tersedia.
 */
import { getPaginationRowModel } from '@tanstack/table-core'
import { createAuthClient } from 'better-auth/vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row } from '@tanstack/table-core'
import type { Claim, ClaimStatus, ClaimStatusFilter } from '~/types'
import type { ClaimsListResponse } from '~/composables/useClaims'
import { CLAIM_STATUS_COLOR, CLAIM_STATUS_FILTER_OPTIONS, CLAIM_STATUS_LABEL } from '~/types'

definePageMeta({
  title: 'Claims'
})

useHead({
  title: 'Claims — QC Market Quality Tracker'
})

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UIcon = resolveComponent('UIcon')

const table = useTemplateRef('table')
const authClient = createAuthClient()
const session = authClient.useSession()

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

const search = ref('')
const statusFilter = ref<ClaimStatusFilter>('all')

const debouncedSearch = refDebounced(search, 300)

const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

// ---------------------------------------------------------------------------
// Data fetching (Task 2.2)
// ---------------------------------------------------------------------------

const { data: claimsResponse, status, refresh } = useClaims({
  search: debouncedSearch,
  status: statusFilter
})

const claims = computed<Claim[]>(() => {
  const payload = claimsResponse.value as (ClaimsListResponse | null | undefined)
  return payload?.data ?? []
})

const currentUser = computed(() => session.value?.data?.user ?? null)

function canManageClaim(claim: Claim) {
  const user = currentUser.value
  if (!user) return false
  if (user.role === 'admin') return true
  return user.role === 'qrcc' && claim.createdBy === user.id
}

const canCreateClaim = computed(() => {
  const role = currentUser.value?.role
  return role === 'admin' || role === 'qrcc'
})

// Reset pagination saat filter berubah.
watch([debouncedSearch, statusFilter], () => {
  table.value?.tableApi?.setPageIndex(0)
})

// ---------------------------------------------------------------------------
// Form modal (Task 2.3)
// ---------------------------------------------------------------------------

const isFormOpen = ref(false)
const editingClaim = ref<Claim | null>(null)

function openCreateForm() {
  if (!canCreateClaim.value) return
  editingClaim.value = null
  isFormOpen.value = true
}

function openEditForm(claim: Claim) {
  if (!canManageClaim(claim)) return
  editingClaim.value = claim
  isFormOpen.value = true
}

async function onClaimSaved() {
  await refresh()
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function statusColor(status: ClaimStatus) {
  return CLAIM_STATUS_COLOR[status]
}

function getRowItems(row: Row<Claim>) {
  const claim = row.original
  const firstGroup = [{
      label: 'Lihat Detail',
      icon: 'i-lucide-eye',
      onSelect: () => {
        navigateTo(`/claims/${claim.id}`)
      }
    }]
  const groups = [firstGroup]

  if (canManageClaim(claim)) {
    groups.push([{
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => openEditForm(claim)
    }])
  }

  return groups
}

const columns: TableColumn<Claim>[] = [
  {
    accessorKey: 'claimCode',
    header: 'Kode Claim',
    cell: ({ row }) => h('div', { class: 'flex flex-col' }, [
      h('span', { class: 'font-mono text-sm font-medium text-highlighted' }, row.original.claimCode),
      h('span', { class: 'text-xs text-muted' }, formatDate(row.original.createdAt))
    ])
  },
  {
    accessorKey: 'productName',
    header: 'Produk / Model',
    cell: ({ row }) => h('div', { class: 'flex flex-col' }, [
      h('span', { class: 'font-medium text-highlighted' }, row.original.productName ?? '-'),
      h('span', { class: 'text-xs text-muted' }, row.original.modelName ?? row.original.modelSku ?? '-')
    ])
  },
  {
    accessorKey: 'defectName',
    header: 'Defect',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.defectName ?? '-')
  },
  {
    accessorKey: 'source',
    header: 'Sumber',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted line-clamp-1 max-w-xs' }, row.original.source)
  },
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: 'equals',
    cell: ({ row }) => h(UBadge, {
      color: statusColor(row.original.status),
      variant: 'subtle',
      label: CLAIM_STATUS_LABEL[row.original.status]
    })
  },
  {
    accessorKey: 'photoCount',
    header: 'Foto',
    cell: ({ row }) => h('div', { class: 'flex items-center gap-1 text-sm text-muted' }, [
      h(UIcon, { name: 'i-lucide-image', class: 'size-3.5' }),
      h('span', undefined, String(row.original.photoCount))
    ])
  },
  {
    accessorKey: 'progressLogCount',
    header: 'Jurnal',
    cell: ({ row }) => h('div', { class: 'flex items-center gap-1 text-sm text-muted' }, [
      h(UIcon, { name: 'i-lucide-notebook-pen', class: 'size-3.5' }),
      h('span', undefined, String(row.original.progressLogCount))
    ])
  },
  {
    id: 'actions',
    cell: ({ row }) => h('div', { class: 'text-right' }, h(UDropdownMenu, {
      content: { align: 'end' },
      items: getRowItems(row)
    }, () => h(UButton, {
      icon: 'i-lucide-ellipsis-vertical',
      color: 'neutral',
      variant: 'ghost',
      class: 'ml-auto',
      ariaLabel: 'Aksi claim'
    })))
  }
]
</script>

<template>
  <UDashboardPanel id="claims">
    <template #header>
      <UDashboardNavbar title="Claims">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            v-if="canCreateClaim"
            icon="i-lucide-plus"
            label="Claim Baru"
            @click="openCreateForm"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Filter bar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <UInput
            v-model="search"
            class="w-full sm:max-w-xs"
            icon="i-lucide-search"
            placeholder="Cari kode claim / sumber..."
          />

          <div class="flex flex-wrap items-center gap-2">
            <USelect
              v-model="statusFilter"
              :items="[...CLAIM_STATUS_FILTER_OPTIONS]"
              value-key="value"
              class="min-w-44"
              placeholder="Filter status"
            />
          </div>
        </div>

        <!-- Tabel utama -->
        <UTable
          ref="table"
          v-model:pagination="pagination"
          :pagination-options="{
            getPaginationRowModel: getPaginationRowModel()
          }"
          :data="claims"
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
              <template v-if="search || statusFilter !== 'all'">
                Tidak ada claim yang cocok dengan filter saat ini.
              </template>
              <template v-else>
                Belum ada claim. Klik tombol "Claim Baru" untuk membuat.
              </template>
            </div>
          </template>
        </UTable>

        <!-- Pagination footer -->
        <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
          <div class="text-sm text-muted">
            {{ claims.length }} claim
          </div>

          <UPagination
            :default-page="(table?.tableApi?.getState().pagination.pageIndex || 0) + 1"
            :items-per-page="table?.tableApi?.getState().pagination.pageSize"
            :total="table?.tableApi?.getFilteredRowModel().rows.length"
            @update:page="(page: number) => table?.tableApi?.setPageIndex(page - 1)"
          />
        </div>
      </div>

      <ClaimFormModal
        v-model="isFormOpen"
        :claim="editingClaim"
        @saved="onClaimSaved"
      />
    </template>
  </UDashboardPanel>
</template>
