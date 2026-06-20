import { db } from '../server/database'
import * as schema from '../server/database/schema'

async function main() {
  const tables = ['products', 'product_models', 'defect_categories', 'defects']
  for (const t of tables) {
    const result = await db.all<{ count: number; sample: unknown }>(
      // drizzle-orm sqlite tidak punya helper count generik, pakai raw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (`SELECT COUNT(*) as count, MAX(createdBy) as sample FROM ${t}` as any)
    )
    console.log(t, '→', result)
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
