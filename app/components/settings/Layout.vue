<script setup lang="ts">
/**
 * Shell untuk halaman Settings.
 *
 * - Menampilkan header dengan judul halaman.
 * - Menampilkan tab navigasi antar sub-menu Settings (lihat useSettingsNav).
 * - Menyediakan slot default untuk konten halaman.
 *
 * Pakai:
 *   <SettingsLayout title="Profile" description="Kelola profil Anda">
 *     <!-- konten -->
 *   </SettingsLayout>
 */
defineProps<{
  title: string
  description?: string
}>()

const { links } = useSettingsNav()
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UNavigationMenu :items="links" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div v-if="description" class="mb-4">
        <p class="text-muted">
          {{ description }}
        </p>
      </div>

      <slot />
    </template>
  </UDashboardPanel>
</template>
