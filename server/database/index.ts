import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

const client = createClient({
  url: process.env.DATABASE_URL || 'file:./data/local.db'
  // authToken: process.env.DATABASE_AUTH_TOKEN, // Gunakan ini jika deploy ke Turso
})

// Instance db di-export agar bisa digunakan di seluruh fungsi server
export const db = drizzle(client, { schema })
