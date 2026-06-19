<script setup lang="ts">
const state = reactive<{ [key: string]: boolean }>({
  email: true,
  desktop: false,
  product_updates: true,
  weekly_digest: false,
  important_updates: true
})

const sections = [{
  title: 'Notification channels',
  description: 'Pilih channel notifikasi yang ingin Anda gunakan.',
  fields: [{
    name: 'email',
    label: 'Email',
    description: 'Terima ringkasan harian via email.'
  }, {
    name: 'desktop',
    label: 'Desktop',
    description: 'Terima notifikasi desktop.'
  }]
}, {
  title: 'Update Sistem',
  description: 'Atur jenis update yang ingin diterima.',
  fields: [{
    name: 'weekly_digest',
    label: 'Ringkasan Mingguan',
    description: 'Terima ringkasan mingguan.'
  }, {
    name: 'product_updates',
    label: 'Update Produk',
    description: 'Terima info fitur dan update terbaru.'
  }, {
    name: 'important_updates',
    label: 'Update Penting',
    description: 'Terima email terkait keamanan dan maintenance.'
  }]
}]

async function onChange() {
  // TODO: simpan preferensi notifikasi ke backend
  console.log(state)
}
</script>

<template>
  <div
    v-for="(section, index) in sections"
    :key="index"
    class="mb-6"
  >
    <UPageCard
      :title="section.title"
      :description="section.description"
      variant="naked"
      class="mb-4"
    />

    <UPageCard
      variant="subtle"
      :ui="{ container: 'divide-y divide-default' }"
    >
      <UFormField
        v-for="field in section.fields"
        :key="field.name"
        :name="field.name"
        :label="field.label"
        :description="field.description"
        class="flex items-center justify-between not-last:pb-4 gap-2"
      >
        <USwitch
          v-model="state[field.name]"
          @update:model-value="onChange"
        />
      </UFormField>
    </UPageCard>
  </div>
</template>
