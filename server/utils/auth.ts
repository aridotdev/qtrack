import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../database' // your drizzle instance
import { z } from 'zod'

// Validasi Zod untuk Role (Single source of truth)
export const RoleSchema = z.enum(['admin', 'qrcc', 'pqa', 'management'])
export type AppRole = z.infer<typeof RoleSchema>

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite' // or "mysql", "sqlite"
  }),
  emailAndPassword: {
    enabled: true
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'qrcc' // Default role saat user baru mendaftar
      }
    }
  }
})
