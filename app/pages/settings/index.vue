<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const fileRef = ref<HTMLInputElement>()

const profileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.email('Email tidak valid'),
  role: z.string(),
  avatar: z.string().optional(),
  bio: z.string().optional()
})

const passwordSchema = z.object({
  oldPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok',
  path: ['confirmPassword']
})

type ProfileSchema = z.output<typeof profileSchema>
type PasswordSchema = z.output<typeof passwordSchema>

const profile = reactive<Partial<ProfileSchema>>({
  name: 'QC User',
  email: 'user@example.com',
  role: 'qrcc',
  avatar: undefined,
  bio: undefined
})

const passwordState = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const toast = useToast()

async function onSubmitProfile(event: FormSubmitEvent<ProfileSchema>) {
  toast.add({
    title: 'Berhasil',
    description: 'Profil berhasil diperbarui.',
    icon: 'i-lucide-check',
    color: 'success'
  })
  console.log(event.data)
}

async function onSubmitPassword(event: FormSubmitEvent<PasswordSchema>) {
  toast.add({
    title: 'Berhasil',
    description: 'Password berhasil diubah.',
    icon: 'i-lucide-check',
    color: 'success'
  })
  console.log(event.data)
  passwordState.oldPassword = ''
  passwordState.newPassword = ''
  passwordState.confirmPassword = ''
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement

  if (!input.files?.length) {
    return
  }

  profile.avatar = URL.createObjectURL(input.files[0]!)
}

function onFileClick() {
  fileRef.value?.click()
}

const roleLabel = computed(() => {
  switch (profile.role) {
    case 'admin': return 'Admin'
    case 'qrcc': return 'QRCC'
    case 'viewer': return 'Viewer'
    default: return profile.role ?? '-'
  }
})
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-8">
    <!-- Profile Info -->
    <UForm
      id="profile-form"
      :schema="profileSchema"
      :state="profile"
      class="mb-6"
      @submit="onSubmitProfile"
    >
      <UPageCard
        title="Informasi Profil"
        description="Nama dan avatar akan ditampilkan di sistem."
        variant="naked"
        orientation="horizontal"
        class="mb-4"
      >
        <UButton
          form="profile-form"
          label="Simpan"
          color="neutral"
          type="submit"
          class="w-fit lg:ms-auto"
        />
      </UPageCard>

      <UPageCard variant="subtle">
        <UFormField
          name="name"
          label="Nama"
          description="Nama lengkap Anda."
          required
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <UInput
            v-model="profile.name"
            autocomplete="off"
            class="w-full max-w-md"
          />
        </UFormField>

        <USeparator />

        <UFormField
          name="email"
          label="Email"
          description="Email yang digunakan untuk login."
          required
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <UInput
            v-model="profile.email"
            type="email"
            autocomplete="off"
            class="w-full max-w-md"
          />
        </UFormField>

        <USeparator />

        <UFormField
          name="role"
          label="Role"
          description="Hak akses Anda di sistem (read-only)."
          class="flex max-sm:flex-col justify-between items-start gap-4"
        >
          <UBadge color="neutral" variant="subtle">
            {{ roleLabel }}
          </UBadge>
        </UFormField>

        <USeparator />

        <UFormField
          name="avatar"
          label="Avatar"
          description="JPG atau PNG. Maks 1MB."
          class="flex max-sm:flex-col justify-between sm:items-center gap-4"
        >
          <div class="flex flex-wrap items-center gap-3">
            <UAvatar
              :src="profile.avatar"
              :alt="profile.name"
              size="lg"
            />
            <UButton
              label="Pilih"
              color="neutral"
              @click="onFileClick"
            />
            <input
              ref="fileRef"
              type="file"
              class="hidden"
              accept=".jpg, .jpeg, .png"
              @change="onFileChange"
            >
          </div>
        </UFormField>

        <USeparator />

        <UFormField
          name="bio"
          label="Bio"
          description="Deskripsi singkat (opsional)."
          class="flex max-sm:flex-col justify-between items-start gap-4"
          :ui="{ container: 'w-full' }"
        >
          <UTextarea
            v-model="profile.bio"
            :rows="4"
            autoresize
            class="w-full max-w-md"
          />
        </UFormField>
      </UPageCard>
    </UForm>
  </div>
</template>
