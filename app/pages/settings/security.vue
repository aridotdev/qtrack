<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

const toast = useToast()

const passwordSchema = z.object({
  current: z.string().min(8, 'Minimal 8 karakter'),
  new: z.string().min(8, 'Minimal 8 karakter'),
  confirm: z.string().min(8, 'Minimal 8 karakter')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  current: '',
  new: '',
  confirm: ''
})

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: 'new', message: 'Password baru harus berbeda dari yang lama' })
  }
  if (state.new && state.confirm && state.new !== state.confirm) {
    errors.push({ name: 'confirm', message: 'Konfirmasi password tidak cocok' })
  }
  return errors
}

async function onSubmit(event: FormSubmitEvent<PasswordSchema>) {
  toast.add({
    title: 'Berhasil',
    description: 'Password berhasil diperbarui.',
    icon: 'i-lucide-check',
    color: 'success'
  })
  console.log(event.data)
  password.current = ''
  password.new = ''
  password.confirm = ''
}
</script>

<template>
  <UPageCard
    title="Password"
    description="Konfirmasi password saat ini sebelum mengubahnya."
    variant="subtle"
  >
    <UForm
      :schema="passwordSchema"
      :state="password"
      :validate="validate"
      class="flex flex-col gap-4 max-w-md"
      @submit="onSubmit"
    >
      <UFormField name="current" class="mb-6">
        <UInput
          v-model="password.current"
          type="password"
          placeholder="Password saat ini"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UFormField name="new">
        <UInput
          v-model="password.new"
          type="password"
          placeholder="Password baru"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UFormField name="confirm">
        <UInput
          v-model="password.confirm"
          type="password"
          placeholder="Ulangi password baru"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <div>
        <UButton
          label="Update"
          type="submit"
        />
      </div>
    </UForm>
  </UPageCard>
</template>
