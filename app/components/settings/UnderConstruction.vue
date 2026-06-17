<script setup lang="ts">
/**
 * Placeholder seragam untuk halaman Settings yang belum diimplementasi.
 *
 * Pakai:
 *   <SettingsUnderConstruction />
 */
defineProps<{
  feature?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] gap-3">
    <UIcon
      name="i-lucide-construction"
      class="size-16 text-muted"
    />
    <h1 class="text-2xl font-semibold">
      Under Construction
    </h1>
    <p class="text-muted text-center max-w-md">
      <template v-if="feature">
        Fitur <span class="font-medium text-highlighted">{{ feature }}</span> sedang dalam pengembangan.
      </template>
      <template v-else>
        Halaman ini sedang dalam pengembangan.
      </template>
    </p>
  </div>
</template>
