<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * Pengaturan Master Data.
 *
 * TODO: implementasi pengaturan master data:
 * - Aturan soft delete (is_active) untuk products, models, defect_types
 * - Field wajib vs opsional per entitas
 * - Validasi kode unik
 * - Bulk import / export master data
 */
const links = [[{
  label: 'Products',
  icon: 'i-lucide-tv',
  to: '/masters',
  exact: true
}, {
  label: 'Models',
  icon: 'i-lucide-users',
  to: '/masters/models'
}, {
  label: 'Defect',
  icon: 'i-lucide-bell',
  to: '/masters/defect'
}, {
  label: 'Defect Categories',
  icon: 'i-lucide-bell',
  to: '/masters/defect-categories'
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Master Data">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-5xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
