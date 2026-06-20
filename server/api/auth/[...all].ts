// server/api/auth/[...all].ts
import { auth } from '../../utils/auth' // Import auth instance dari utils
import { defineEventHandler, toWebRequest } from 'h3'

export default defineEventHandler(async (event) => {
  // Ubah H3 event menjadi standar Web Request yang dipahami Better Auth
  return auth.handler(toWebRequest(event))
})
