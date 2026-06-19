<script setup lang="ts">
/**
 * Pengaturan modul Claims.
 *
 * TODO: implementasi pengaturan klaim:
 * - Default status saat claim dibuat
 * - Template kode claim
 * - Aturan SLA / auto-close
 * - Notifikasi perubahan status
 */
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar title="Customers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <CustomersAddModal />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <SettingsUnderConstruction feature="Pengaturan Claims" />
    </template>
  </UDashboardPanel>
</template>
