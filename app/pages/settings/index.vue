<script setup lang="ts">
// Redirect ke halaman settings/profile sebagai default
definePageMeta({
  middleware: () => navigateTo('/settings/profile')
})
</script>

<template>
  <div />
</template>
