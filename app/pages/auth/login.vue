<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import { createAuthClient } from 'better-auth/vue'

definePageMeta({
  layout: 'blank'
})

useHead({
  title: 'Sign in'
})

const toast = useToast()
const router = useRouter()
const authClient = createAuthClient()

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
}]

const schema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  const { data, error } = await authClient.signIn.email({
    email: payload.data.email,
    password: payload.data.password
  })

  if (error) {
    toast.add({
      title: 'Login gagal',
      description: error.message ?? 'Email atau password salah',
      color: 'error'
    })
    return
  }

  toast.add({
    title: 'Login berhasil',
    description: `Selamat datang, ${data?.user?.name ?? payload.data.email}`,
    color: 'success'
  })

  await router.push('/')
}
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-4 bg-default p-4">
    <UPageCard class="w-full max-w-sm">
      <UAuthForm
        :schema="schema"
        title="Login"
        description="Enter your credentials to access your account."
        icon="i-lucide-user"
        :fields="fields"
        @submit="onSubmit"
      />
    </UPageCard>
  </div>
</template>
